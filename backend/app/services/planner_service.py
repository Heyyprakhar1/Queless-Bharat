"""Smart Visit Planner service orchestrating arrival window recommendations and checklists."""

import math
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.enums import EstimateConfidence
from app.domain.exceptions import ResourceNotFoundError
from app.domain.models import Service
from app.schemas.planner import (
    ArrivalWindowRecommendation,
    DocumentChecklist,
    DocumentChecklistItem,
    VisitPlanResponse,
)
from app.services.estimation_service import EstimationService

# Authoritative government verified and statutory document checklists
_VERIFIED_CHECKLIST_CATALOG: dict[str, dict] = {
    "driving_licence_renewal": {
        "match_substrings": [
            "driving licence renewal",
            "driving license renewal",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Ministry of Road Transport and Highways (MoRTH) / Sarathi Parivahan",
        "source_url": "https://sarathi.parivahan.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="dl_original",
                name="Original Driving Licence",
                description=(
                    "Physical licence card to be inspected and surrendered for new smart card "
                    "issuance (CMVR 1989 Rule 18(1)(a))."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "If lost or stolen, an official police report (NC) and Form LLD are required."
                ),
            ),
            DocumentChecklistItem(
                id="medical_form_1a",
                name="Medical Certificate (Form 1-A)",
                description=(
                    "Official medical fitness certificate signed and sealed by a registered "
                    "medical practitioner (CMVR 1989 Rules 5(1), (3), 18(d))."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for transport/commercial vehicle licence holders and all applicants "
                    "aged 40 years or older per CMVR 1989 Rule 5(1)."
                ),
                notes=(
                    "Must carry registered practitioner's state medical council r"
                    "egistration number."
                ),
            ),
            DocumentChecklistItem(
                id="proof_identity_address",
                name="Proof of Age & Address",
                description=(
                    "Valid government-issued photo identity and address document (Aadhaar, "
                    "Voter ID, or Passport per CMVR Rule 4 & 18(1)(b))."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Present physical original for in-person visual inspection plus a signed "
                    "self-attested copy."
                ),
            ),
            DocumentChecklistItem(
                id="sarathi_form_9",
                name="Sarathi Online Application Acknowledgement (Form 9)",
                description=(
                    "Printed confirmation slip or application reference receipt from the Sarathi "
                    "Parivahan portal (CMVR Rule 18(1))."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Must clearly display your Application Number and verified fee payment status."
                ),
            ),
        ],
    },
    "learner_licence": {
        "match_substrings": [
            "learner licence test & biometrics",
            "learner licence",
            "learner license",
            "learner's licence",
            "learner's license",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Ministry of Road Transport and Highways (MoRTH) / Sarathi Parivahan",
        "source_url": "https://sarathi.parivahan.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="ll_form2_ack",
                name="Online Application Acknowledgement (Form 2)",
                description=(
                    "Printed Sarathi confirmation receipt displaying application number and "
                    "computerized test slot reference (CMVR 1989 Rule 10)."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Confirms statutory exam appointment time and payment receipt.",
            ),
            DocumentChecklistItem(
                id="ll_age_proof",
                name="Proof of Age & Date of Birth",
                description=(
                    "Valid document certifying date of birth (Birth Certificate, 10th standard "
                    "school certificate, or Passport per CMVR 1989 Rule 4)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Physical original required for desk verification plus self-attested copy.",
            ),
            DocumentChecklistItem(
                id="ll_address_proof",
                name="Proof of Current Residential Address",
                description=(
                    "Government-issued address verification within the local RTO jurisdiction "
                    "(Aadhaar, Voter ID, or utility bill per CMVR Rule 4)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Jurisdiction of RTO is strictly determined by this address.",
            ),
            DocumentChecklistItem(
                id="ll_form1_self_decl",
                name="Physical Fitness Self-Declaration (Form 1)",
                description=(
                    "Self-declaration of physical fitness for non-transport category "
                    "per CMVR 1989 Rule 5(2)."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Signed self-certification completed online and printed with application.",
            ),
            DocumentChecklistItem(
                id="ll_parent_consent",
                name="Parent or Guardian Consent Declaration",
                description=(
                    "Written consent signed by parent or guardian for applicants aged 16–18 "
                    "per Motor Vehicles Act 1988 Section 4(1)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory only for applicants aged 16–18 applying for a licence to drive a "
                    "motorcycle without gear (engine capacity not exceeding 50cc)."
                ),
                notes=(
                    "Parent or guardian must sign before the licensing authority "
                    "or provide attested declaration."
                ),
            ),
        ],
    },
    "permanent_driving_licence": {
        "match_substrings": [
            "permanent driving licence track",
            "driving licence smart card issuance",
            "licence endorsement & renewal",
            "permanent driving licence",
            "driving licence smart card",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Ministry of Road Transport and Highways (MoRTH) / Sarathi Parivahan",
        "source_url": "https://sarathi.parivahan.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="pdl_valid_ll",
                name="Valid Learner Licence",
                description=(
                    "Physical learner licence held for a minimum of 30 days prior to the practical "
                    "test date (CMVR 1989 Rule 15)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Must be active and unexpired on the date of practical track evaluation.",
            ),
            DocumentChecklistItem(
                id="pdl_slot_slip",
                name="Driving Test Slot Booking Slip",
                description=(
                    "Printed appointment confirmation from Sarathi portal specifying designated "
                    "track slot and test center."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Carries applicant photo, application number, and designated reporting hour.",
            ),
            DocumentChecklistItem(
                id="pdl_driving_school_form5",
                name="Driving School Certificate of Competence (Form 5)",
                description=(
                    "Certificate issued by an accredited driving training school "
                    "per CMVR 1989 Rule 27."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for commercial/transport vehicle test candidates, or non-transport "
                    "applicants seeking waiver through accredited driving school certification."
                ),
                notes="Must carry the valid accreditation number of the driving school.",
            ),
            DocumentChecklistItem(
                id="pdl_test_vehicle_docs",
                name="Category-Compliant Test Vehicle Documentation",
                description=(
                    "Registration Certificate (RC), valid insurance, and PUC certificate for the "
                    "vehicle presented for the driving track test."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for all practical test candidates presenting their own vehicle "
                    "for on-track driving evaluation."
                ),
                notes=(
                    "Vehicle must display standard 'L' plates and match applied licence category."
                ),
            ),
        ],
    },
    "vehicle_registration_and_transfer": {
        "match_substrings": [
            "vehicle registration & transfer",
            "vehicle registration and transfer",
            "vehicle registration & ownership transfer",
            "vehicle registration and ownership transfer",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Ministry of Road Transport and Highways (MoRTH) / Vahan Parivahan",
        "source_url": "https://vahan.parivahan.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="vrt_rc_original",
                name="Original Registration Certificate (RC)",
                description=(
                    "Physical smart card or paper RC booklet to be submitted for transfer "
                    "endorsement (CMVR 1989 Rule 55)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Original card will be cancelled or endorsed with the new owner's identity.",
            ),
            DocumentChecklistItem(
                id="vrt_form_29",
                name="Form 29 (Notice of Transfer of Ownership)",
                description=(
                    "Form 29 in duplicate duly signed by transferor (seller) and "
                    "transferee (buyer) per CMVR Rule 55(1)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Both copies must bear original signatures and identity verification.",
            ),
            DocumentChecklistItem(
                id="vrt_form_30",
                name="Form 30 (Application for Transfer of Ownership)",
                description=(
                    "Form 30 in duplicate containing signatures of buyer and seller "
                    "per CMVR Rule 55(2)."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Specifies detailed vehicle chassis, engine number, and sale consideration.",
            ),
            DocumentChecklistItem(
                id="vrt_insurance",
                name="Valid Motor Vehicle Insurance Certificate",
                description="Active comprehensive or third-party vehicle insurance policy.",
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Must be valid on the date of submission and transferred to new owner.",
            ),
            DocumentChecklistItem(
                id="vrt_puc",
                name="Pollution Under Control (PUC) Certificate",
                description=(
                    "Valid emissions testing clearance certificate from an author"
                    "ized testing centre."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Mandatory under Section 190(2) of the Motor Vehicles Act 1988.",
            ),
            DocumentChecklistItem(
                id="vrt_form_28_noc",
                name="Form 28 No Objection Certificate (NOC)",
                description=(
                    "NOC in triplicate issued by original registering authority "
                    "per CMVR 1989 Rule 58."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory in triplicate if the vehicle was previously registered under a "
                    "different RTO jurisdiction or outside the target state."
                ),
                notes="Must include police clearance verification from crime records bureau.",
            ),
            DocumentChecklistItem(
                id="vrt_form_35_hypothecation",
                name="Financier No Objection / Form 35",
                description="Form 35 in duplicate along with loan closure clearance letter.",
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory if the vehicle was subject to an active bank loan, lease, "
                    "or hypothecation agreement."
                ),
                notes="Signed and sealed by authorized loan officer.",
            ),
        ],
    },
    "international_driving_permit": {
        "match_substrings": [
            "international driving permit & licence",
            "international driving permit",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Delhi Transport Department / MoRTH Sarathi Parivahan",
        "source_url": "https://sarathi.parivahan.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="idp_original_dl",
                name="Valid Domestic Driving Licence",
                description=(
                    "Physical Indian driving licence valid for at least one full year "
                    "per CMVR 1989 Rule 14(a)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Must be issued in smart card format with updated residential address.",
            ),
            DocumentChecklistItem(
                id="idp_passport_visa",
                name="Indian Passport & Valid Overseas Visa",
                description=(
                    "Valid passport plus destination country visa or official travel authorization."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Original passport for physical inspection plus signed self-attested copies.",
            ),
            DocumentChecklistItem(
                id="idp_air_ticket",
                name="Confirmed Air Ticket / Flight Itinerary",
                description="Proof of departure within valid permit timeline.",
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Must display applicant's name and international departure date.",
            ),
            DocumentChecklistItem(
                id="idp_medical_1a",
                name="Medical Certificate (Form 1-A)",
                description=(
                    "Official medical fitness certificate signed by a registered medical "
                    "practitioner (CMVR Rule 5(1))."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Mandatory statutory requirement for all IDP applicants regardless of age.",
            ),
            DocumentChecklistItem(
                id="idp_form_4a_photos",
                name="Form 4-A Acknowledgement & Passport Photographs",
                description=(
                    "Sarathi IDP application slip with 3 identical recent passpor"
                    "t photos (35mm x 45mm)."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Photographs must be on white background without sunglasses or head coverings."
                ),
            ),
        ],
    },
    "radiology_ultrasound": {
        "match_substrings": [
            "radiology & ultrasound token",
            "ultrasound & imaging token desk",
            "radiology & ultrasound",
            "ultrasound & imaging",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Ministry of Health and Family Welfare (MoHFW) / PCPNDT Statutory Mandate",
        "source_url": "https://www.mohfw.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="pcpndt_prescription",
                name="Registered Doctor's Ultrasound Referral",
                description=(
                    "Clinical ultrasound referral signed and sealed by a treating physician "
                    "per PCPNDT Act 1994 Rule 9."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Must explicitly state clinical indication, referring doctor'"
                    "s registration number, and stamp."
                ),
            ),
            DocumentChecklistItem(
                id="pcpndt_id",
                name="Patient Government Photo ID & Address Proof",
                description=(
                    "Original Aadhaar Card, Voter ID, or Passport presented for statutory logging "
                    "in PCPNDT Form F register."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Photocopy retained in diagnostic centre statutory archive fo"
                    "r mandatory inspection."
                ),
            ),
            DocumentChecklistItem(
                id="pcpndt_form_f",
                name="Statutory Form F Patient Declaration",
                description=(
                    "Statutory declaration completed and signed at the diagnostic centre before "
                    "the investigation per PCPNDT Act Section 4(3)."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Mandatory legal record acknowledging prohibition of sex determination.",
            ),
            DocumentChecklistItem(
                id="prior_imaging",
                name="Previous Diagnostic Reports & Operative Records",
                description=(
                    "Prior ultrasound, CT, or surgical discharge summaries for comparative "
                    "medical review."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Required for obstetric anomaly scans, longitudinal fetal monitoring, "
                    "or targeted follow-up examinations."
                ),
                notes=(
                    "Assists the radiologist in evaluating serial developmental o"
                    "r pathological changes."
                ),
            ),
        ],
    },
    "birth_and_death_certificate": {
        "match_substrings": [
            "birth & death certificate counter",
            "birth & death certificate",
            "birth/death certificate",
        ],
        "verification_status": "VERIFIED",
        "source_title": (
            "Pune Municipal Corporation (PMC) / Registration of Births and Deaths Act 1969"
        ),
        "source_url": "https://pmc.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="bd_hospital_slip",
                name="Hospital Discharge & Event Slip (Form 1 / Form 2)",
                description=(
                    "Official institutional event notification slip issued by hospital or nursing "
                    "home per RBD Act 1969 Section 12."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Carries institutional medical record number and vital statistics extract code."
                ),
            ),
            DocumentChecklistItem(
                id="bd_parents_id",
                name="Parents' / Informant's Government Photo ID",
                description=(
                    "Aadhaar Card or Voter ID of parents or informant for civil r"
                    "egistry identity match."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Original examined for name spelling verification against civ"
                    "ic registry extract."
                ),
            ),
            DocumentChecklistItem(
                id="bd_marriage_cert",
                name="Parents' Marriage Certificate",
                description="Registered marriage certificate or gazette notification.",
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Required if parents' surnames differ on institutional records or in case of "
                    "rectification of parental names on the extract."
                ),
                notes="Submitted along with joint affidavit if requested by municipal registrar.",
            ),
            DocumentChecklistItem(
                id="bd_magistrate_order",
                name="Executive Magistrate Delayed Registration Order",
                description=(
                    "Formal sanction order issued by Sub-Divisional Magistrate (SDM) or Tehsildar "
                    "under RBD Act 1969 Section 13(3)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for birth or death registrations delayed by more than one full year "
                    "from the date of occurrence."
                ),
                notes="Issued following verification by local revenue enquiry officer.",
            ),
        ],
    },
    "hospital_opd_registration": {
        "match_substrings": [
            "opd general medicine registration",
            "opd specialty consultation",
            "outpatient registration desk",
            "rajkumari amrit kaur opd desk",
            "shatabdi opd registration",
            "emergency & opd registration",
            "general medicine opd token",
        ],
        "verification_status": "PARTIALLY_VERIFIED",
        "source_title": "National Health Authority / Online Registration System (ORS)",
        "source_url": "https://ors.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="opd_abha_id",
                name="Ayushman Bharat Health Account (ABHA / UHID)",
                description=(
                    "14-digit ABHA number or QR code card for express digital triage registration "
                    "and longitudinal EHR linkage."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Enables fast-track queue scan at ABDM-enabled digital hospital kiosks.",
            ),
            DocumentChecklistItem(
                id="opd_photo_id",
                name="Government Photo Identity Proof",
                description=(
                    "Original Aadhaar, Voter ID, or Driving Licence for patient i"
                    "dentity confirmation."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Required at physical intake window for demographic record generation.",
            ),
            DocumentChecklistItem(
                id="opd_referral",
                name="Primary Care Referral Slip",
                description=(
                    "Clinical referral note from a primary health centre or general medicine OPD."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for specialty and super-specialty tertiary clinics (Cardiology, "
                    "Neurology, Oncology) referred from general triage."
                ),
                notes="Must display referring physician's stamp and clinical diagnosis.",
            ),
            DocumentChecklistItem(
                id="opd_pmjay",
                name="Ayushman Bharat PM-JAY / BPL Beneficiary Card",
                description=(
                    "Government health insurance card or BPL certificate for civic fee waivers."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Required for citizens claiming exemption from diagnostic investigation "
                    "and consultation fees under PM-JAY or state schemes."
                ),
                notes="Verified against national PM-JAY beneficiary database.",
            ),
        ],
    },
    "municipal_property_tax": {
        "match_substrings": [
            "property tax assessment & payment",
            "water & property tax desk",
            "khata certificate & property desk",
            "citizen services & property tax",
            "public grievance & certificates",
            "assessment & collection counter",
            "trade licence & property tax",
            "property tax & billing counter",
        ],
        "verification_status": "PARTIALLY_VERIFIED",
        "source_title": "Municipal Corporation Civic Service Portal",
        "source_url": "https://pmc.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="pt_bill_receipt",
                name="Previous Property Tax Bill / UPIC / PTIN Receipt",
                description=(
                    "Prior year tax assessment bill or unique property identification code receipt "
                    "displaying ward and GIS index number."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Assists counter staff in pulling existing digital municipal revenue ledger.",
            ),
            DocumentChecklistItem(
                id="pt_sale_deed",
                name="Registered Title Deed / Index-II Extract",
                description=(
                    "Registered sale deed, conveyance deed, or sub-registrar Index-II extract "
                    "confirming property title."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Original examined for authenticity; photocopy retained for revenue files.",
            ),
            DocumentChecklistItem(
                id="pt_owner_id",
                name="Property Owner Government Photo ID & PAN",
                description="Aadhaar Card and PAN card of the legal property owner.",
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes="Present original for inspection plus signed self-attested copies.",
            ),
            DocumentChecklistItem(
                id="pt_khata_extract",
                name="Khata Extract / Revenue Mutation Certificate",
                description="Municipal revenue record extract or mutation certificate.",
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for ownership transfer, revenue record mutation, or BBMP A/B-Khata "
                    "certificate issuance."
                ),
                notes="Issued by local municipal assistant revenue officer (ARO).",
            ),
            DocumentChecklistItem(
                id="pt_sanctioned_plan",
                name="Sanctioned Building Plan or Completion Certificate",
                description=(
                    "Approved architectural building plan and commencement/completion certificate."
                ),
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Required for new property assessment or reassessment following structural "
                    "alterations or built-up area additions."
                ),
                notes="Approved by municipal town planning authority.",
            ),
        ],
    },
    "pathology_blood_sampling": {
        "match_substrings": [
            "fast-track blood sampling",
            "pathology & blood sample collection",
            "pathology blood sample",
            "blood sample collection",
            "blood sampling",
        ],
        "verification_status": "PARTIALLY_VERIFIED",
        "source_title": "National Diagnostic Centre / NABL Clinical Protocol",
        "source_url": "https://www.mohfw.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="path_requisition",
                name="Registered Doctor's Pathology Test Requisition",
                description=(
                    "Medical prescription specifying required laboratory investigations "
                    "and relevant clinical diagnosis."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes="Ensures proper test tube barcodes and analytical profiles are assigned.",
            ),
            DocumentChecklistItem(
                id="path_patient_id",
                name="Patient Photo Identity Proof",
                description=(
                    "Government-issued photo identification for laboratory record verification."
                ),
                requirement_type="BOTH_ORIGINAL_AND_PHOTOCOPY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Mandatory for specimen integrity, report delivery, and digital portal access."
                ),
            ),
            DocumentChecklistItem(
                id="path_fasting_slip",
                name="Fasting Protocol Compliance Slip",
                description="Confirmation of 10–12 hour overnight fasting duration.",
                requirement_type="PHOTOCOPY_ONLY",
                is_mandatory=False,
                is_conditional=True,
                condition_description=(
                    "Mandatory for fasting blood glucose (FBS), lipid profile, fasting insulin, "
                    "and specific metabolic pathology panels."
                ),
                notes="Patient must confirm time of last food and beverage intake.",
            ),
        ],
    },
    "aadhaar_identity_update": {
        "match_substrings": [
            "aadhaar & identity update",
            "aadhaar card & identity modification",
            "aadhaar update",
            "aadhaar modification",
            "jan aadhaar card update",
        ],
        "verification_status": "VERIFIED",
        "source_title": "Unique Identification Authority of India (UIDAI)",
        "source_url": "https://myaadhaar.uidai.gov.in/",
        "verification_date": "2026-10-12",
        "items": [
            DocumentChecklistItem(
                id="poi_original",
                name="Proof of Identity (POI)",
                description=(
                    "Valid document containing applicant's full name and photograph (Passport, "
                    "PAN Card, Voter ID, or Driving Licence)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Per UIDAI regulatory standards, physical original document must be produced "
                    "for live optical scanning. Photocopies are strictly not accepted."
                ),
            ),
            DocumentChecklistItem(
                id="poa_original",
                name="Proof of Address (POA)",
                description=(
                    "Valid residential address proof (Electricity/Water bill within 3 months, "
                    "Bank Passbook with photograph, or Passport)."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Physical original document must be presented for real-time document capture "
                    "at the update window."
                ),
            ),
            DocumentChecklistItem(
                id="aadhaar_slip",
                name="Existing Aadhaar Number / Enrolment Slip",
                description=(
                    "Physical Aadhaar letter, plastic PVC card, or printed e-Aadhaar displaying "
                    "12-digit UID."
                ),
                requirement_type="ORIGINAL_ONLY",
                is_mandatory=True,
                is_conditional=False,
                notes=(
                    "Citizen physical presence is mandatory for biometric verification "
                    "(fingerprint/iris/photo)."
                ),
            ),
        ],
    },
}


class PlannerService:
    """Business logic for deterministic visit planning and verified document checklists."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.estimation_service = EstimationService(session)

    def _resolve_document_checklist(
        self,
        service_id: uuid.UUID,
        service_name: str,
        city: str | None = None,
    ) -> DocumentChecklist:
        """Resolves authoritative document checklist for the given service."""
        lower_name = service_name.lower().strip()

        matched_spec = None
        matched_key = None
        for key, spec in _VERIFIED_CHECKLIST_CATALOG.items():
            if any(substring in lower_name for substring in spec["match_substrings"]):
                matched_spec = spec
                matched_key = key
                break

        if matched_spec:
            verif_status = matched_spec.get("verification_status", "VERIFIED")
            source_title = matched_spec["source_title"]
            source_url = matched_spec["source_url"]

            # City-aware authority and source URL resolution for municipal civic services
            if matched_key == "birth_and_death_certificate":
                city_clean = city.strip().lower() if city else None
                if city_clean == "patna":
                    # Patna Municipal Corporation under federal
                    # Registration of Births and Deaths Act 1969.
                    # Portal URL is not verified in repository; do not fabricate.
                    source_title = (
                        "Patna Municipal Corporation (PMC) / "
                        "Registration of Births and Deaths Act 1969"
                    )
                    source_url = None
                    verif_status = "PARTIALLY_VERIFIED"
                elif city_clean and city_clean != "pune":
                    source_title = (
                        f"{city.strip()} Municipal Authority / "
                        "Registration of Births and Deaths Act 1969"
                    )
                    source_url = None
                    verif_status = "PARTIALLY_VERIFIED"

            return DocumentChecklist(
                service_id=service_id,
                service_name=service_name,
                verification_status=verif_status,
                has_verified_checklist=verif_status in ("VERIFIED", "PARTIALLY_VERIFIED"),
                source_title=source_title,
                source_url=source_url,
                verification_date=matched_spec["verification_date"],
                disclaimer="Completing this checklist does not guarantee approval or service.",
                items=matched_spec["items"],
            )

        # Unverified service
        return DocumentChecklist(
            service_id=service_id,
            service_name=service_name,
            verification_status="UNVERIFIED",
            has_verified_checklist=False,
            source_title=None,
            source_url=None,
            verification_date=None,
            disclaimer=(
                "Official verified checklist is not yet available for this service. "
                "Please verify requirements directly with the facility."
            ),
            items=[],
        )

    def _calculate_arrival_window(
        self,
        queue_status,
        now: datetime,
    ) -> ArrivalWindowRecommendation:
        """Calculates a deterministic arrival window recommendation from current queue metrics."""
        est = queue_status.estimated_wait
        active_counters = queue_status.active_counters
        freshness_sec = est.freshness_seconds

        # 1. Check if wait estimate is unavailable
        if not est.is_available:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=est.confidence,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason=est.reason or "Queue estimation is currently unavailable.",
            )

        # 2. Check for halted queue / zero active counters
        if active_counters <= 0:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=est.confidence,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason="All service counters are currently closed or halted.",
            )

        # 3. Check for stale data (> 1800 seconds / 30 minutes) or missing freshness timestamp
        if freshness_sec is None or freshness_sec > 1800:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=None,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason="Current estimate unavailable — latest queue data is stale. Please verify with the facility.",
            )

        # 4. Check for low confidence or sparse data
        if est.confidence == EstimateConfidence.LOW:
            return ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=EstimateConfidence.LOW,
                data_freshness_seconds=freshness_sec,
                last_updated=now,
                reason=(
                    "Throughput variance is currently high or sample baseline is small. "
                    "Arrival window cannot be reliably projected."
                ),
            )

        # 5. Deterministic calculation with sufficient, fresh data
        lower_wait = est.lower_minutes if est.lower_minutes is not None else 0.0
        upper_wait = est.upper_minutes if est.upper_minutes is not None else 0.0
        expected_wait = est.expected_minutes if est.expected_minutes is not None else 0.0

        if expected_wait <= 10.0:
            # Short wait: recommend arriving soon to take advantage of low congestion
            window_start = 5
            window_end = max(15, int(math.ceil(upper_wait + 5)))
        elif expected_wait <= 45.0:
            # Moderate wait: recommend window buffered by lower bound
            window_start = max(10, int(math.floor(lower_wait * 0.5)))
            window_end = max(window_start + 15, int(math.ceil(upper_wait * 0.9)))
        else:
            # Long wait: wider buffer
            window_start = max(15, int(math.floor(lower_wait * 0.6)))
            window_end = max(window_start + 20, int(math.ceil(upper_wait * 0.85)))

        avg_duration = est.supporting_signals.get("avg_service_time_minutes", 5.0)

        assumptions = [
            f"Assumes active counter count ({active_counters} open desks) remains consistent.",
            f"Based on recent empirical service throughput (~{avg_duration} minutes per citizen).",
            "Assumes steady queue clearance without unforeseen high-priority emergency cases.",
            "Subject to facility operating hours and scheduled staff lunch/tea breaks.",
        ]

        return ArrivalWindowRecommendation(
            is_recommended=True,
            confidence=est.confidence,
            window_start_minutes=window_start,
            window_end_minutes=window_end,
            suggested_arrival_text=f"Within {window_start}–{window_end} minutes",
            data_freshness_seconds=freshness_sec,
            last_updated=now,
            assumptions=assumptions,
            reason=None,
        )

    async def get_visit_plan(self, service_id: uuid.UUID) -> VisitPlanResponse:
        """Retrieves or calculates the Smart Visit Plan for a given service."""
        # 1. Fetch service with location details
        stmt = (
            select(Service).options(selectinload(Service.location)).where(Service.id == service_id)
        )
        service = (await self.session.execute(stmt)).scalar_one_or_none()
        if not service:
            raise ResourceNotFoundError("Service", str(service_id))

        now = datetime.now(UTC)

        # 2. Query deterministic queue status from EstimationService
        try:
            queue_status = await self.estimation_service.get_service_queue_status(
                service_id=service_id, persist_estimate=False
            )
            # 3. Derive deterministic arrival window recommendation
            arrival_window = self._calculate_arrival_window(queue_status, now)
            is_simulated = queue_status.is_simulated
        except Exception:
            # Telemetry degradation: queue estimation failure must not block document checklist
            arrival_window = ArrivalWindowRecommendation(
                is_recommended=False,
                confidence=None,
                data_freshness_seconds=None,
                last_updated=now,
                reason="Live queue telemetry is currently unavailable.",
            )
            is_simulated = True

        location_name = service.location.name if service.location else "Unknown Location"
        city = service.location.city if service.location else "Unknown City"

        # 4. Resolve verified document checklist with city context
        document_checklist = self._resolve_document_checklist(
            service.id,
            service.name,
            city=service.location.city if service.location else None,
        )

        return VisitPlanResponse(
            service_id=service.id,
            service_name=service.name,
            location_name=location_name,
            city=city,
            arrival_window=arrival_window,
            document_checklist=document_checklist,
            is_simulated=is_simulated,
        )
