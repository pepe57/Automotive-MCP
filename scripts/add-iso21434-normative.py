#!/usr/bin/env python3
"""Add ISO 21434 normative content to standards.json seed data.

Adds normative_text (requirements [RQ-15-xx]) and reference_tables
(Annex F/G/H structured data) to existing ISO 21434 clause entries.

Run: python3 scripts/add-iso21434-normative.py
"""

import json
import os

SEED_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "seed", "standards.json")

# ── Clause 15 normative requirements ─────────────────────────────────────────

NORMATIVE = {
    "15": (
        "[RQ-15-01] Damage scenarios shall be identified.\n"
        "[RQ-15-02] Assets with cybersecurity properties whose compromise leads to a damage scenario shall be identified.\n"
        "[RQ-15-03] Threat scenarios shall be identified and include: targeted asset, compromised cybersecurity property, and cause of compromise.\n"
        "[RQ-15-04] Damage scenarios shall be assessed against potential adverse consequences for road users in the impact categories of safety, financial, operational, and privacy (S, F, O, P).\n"
        "[RQ-15-05] The impact rating of a damage scenario shall be determined for each impact category as: severe, major, moderate, or negligible.\n"
        "[RQ-15-06] Safety related impact ratings shall be derived from ISO 26262-3:2018, 6.4.3.\n"
        "[PM-15-07] If a damage scenario results in an impact rating and an argument can be made that every impact of another category is considered less critical, then further analysis for that other category may be omitted.\n"
        "[RQ-15-08] Threat scenarios shall be analysed to identify attack paths.\n"
        "[RQ-15-09] An attack path shall be associated with the threat scenarios that can be realized by the attack path.\n"
        "[RQ-15-10] For each attack path, the attack feasibility rating shall be determined as: High, Medium, Low, or Very low.\n"
        "[RC-15-11] The attack feasibility rating method should be defined based on one of: (a) attack potential-based approach, (b) CVSS-based approach, or (c) attack vector-based approach.\n"
        "[RC-15-12] If attack potential-based: rating should be determined based on: (a) elapsed time, (b) specialist expertise, (c) knowledge of the item/component, (d) window of opportunity, (e) equipment.\n"
        "[RC-15-13] If CVSS-based: rating should be determined based on exploitability metrics: (a) attack vector, (b) attack complexity, (c) privileges required, (d) user interaction.\n"
        "[RC-15-14] If attack vector-based: rating should be determined based on evaluating the predominant attack vector of the attack path.\n"
        "[RQ-15-15] For each threat scenario the risk value shall be determined from the impact of the associated damage scenarios and the attack feasibility of the associated attack paths.\n"
        "[RQ-15-16] The risk value of a threat scenario shall be a value between 1 and 5, where 1 represents minimal risk.\n"
        "[RQ-15-17] For each threat scenario, considering its risk values, one or more risk treatment options shall be determined: (a) avoiding the risk, (b) reducing the risk, (c) sharing the risk, (d) retaining the risk."
    ),
    "15.3": (
        "[RQ-15-01] Damage scenarios shall be identified. A damage scenario can include: relation between item functionality and adverse consequence, description of harm to road user, and/or relevant assets.\n"
        "[RQ-15-02] Assets with cybersecurity properties whose compromise leads to a damage scenario shall be identified. Identification can be based on: analysing the item definition, performing an impact rating, deriving assets from threat scenarios, and/or using predefined catalogues.\n"
        "Work products: [WP-15-01] Damage scenarios. [WP-15-02] Assets with cybersecurity properties."
    ),
    "15.4": (
        "[RQ-15-03] Threat scenarios shall be identified and include: targeted asset, compromised cybersecurity property of the asset, and cause of compromise of the cybersecurity property.\n"
        "The method for threat scenario identification can use group discussion and/or systematic approaches such as: elicitation of malicious use cases from reasonably foreseeable misuse/abuse, or threat modelling approaches based on frameworks such as EVITA, TVRA, PASTA, STRIDE.\n"
        "A damage scenario can correspond to multiple threat scenarios and a threat scenario can lead to multiple damage scenarios.\n"
        "Work products: [WP-15-03] Threat scenarios."
    ),
    "15.5": (
        "[RQ-15-04] Damage scenarios shall be assessed against potential adverse consequences for road users in the impact categories of safety (S), financial (F), operational (O), and privacy (P) respectively.\n"
        "[RQ-15-05] The impact rating of a damage scenario shall be determined for each impact category as one of: severe, major, moderate, or negligible.\n"
        "[RQ-15-06] Safety related impact ratings shall be derived from ISO 26262-3:2018, 6.4.3.\n"
        "[PM-15-07] If a damage scenario results in an impact rating and an argument can be made that every impact of another category is considered less critical, then further analysis for that other category may be omitted.\n"
        "Financial, operational and privacy related impacts can be rated in accordance with tables given in Annex F.\n"
        "Work products: [WP-15-04] Impact ratings with associated impact categories."
    ),
    "15.6": (
        "[RQ-15-08] Threat scenarios shall be analysed to identify attack paths. Attack path analysis can be based on: top-down approaches that deduce attack paths by analysing different ways a threat scenario could be realised (attack trees, attack graphs), and/or bottom-up approaches that build attack paths from identified vulnerabilities.\n"
        "[RQ-15-09] An attack path shall be associated with the threat scenarios that can be realized by the attack path.\n"
        "If a partial attack path does not lead to the realization of a threat scenario, the analysis of this partial attack path can be stopped.\n"
        "In early stages of product development, attack paths are often incomplete or imprecise as specific implementation details are not yet known.\n"
        "Work products: [WP-15-05] Attack paths."
    ),
    "15.7": (
        "[RQ-15-10] For each attack path, the attack feasibility rating shall be determined as described in Table 1: High (low effort), Medium (medium effort), Low (high effort), Very low (very high effort).\n"
        "[RC-15-11] The attack feasibility rating method should be defined based on one of: (a) attack potential-based approach, (b) CVSS-based approach, or (c) attack vector-based approach. Selection can depend on lifecycle phase and available information.\n"
        "[RC-15-12] If attack potential-based approach is used, the attack feasibility rating should be determined based on core factors: (a) elapsed time, (b) specialist expertise, (c) knowledge of the item or component, (d) window of opportunity, (e) equipment. The core factors can be derived from ISO/IEC 18045.\n"
        "[RC-15-13] If CVSS-based approach is used, the attack feasibility rating should be determined based on the exploitability metrics of the base metric group: (a) attack vector, (b) attack complexity, (c) privileges required, (d) user interaction.\n"
        "[RC-15-14] If attack vector-based approach is used, the attack feasibility rating should be determined based on evaluating the predominant attack vector of the attack path.\n"
        "Work products: [WP-15-06] Attack feasibility ratings."
    ),
    "15.8": (
        "[RQ-15-15] For each threat scenario the risk value shall be determined from the impact of the associated damage scenarios and the attack feasibility of the associated attack paths.\n"
        "If a threat scenario corresponds to more than one damage scenario and/or an associated damage scenario has impacts in more than one impact category, a separate risk value can be determined for each of those impact ratings.\n"
        "If the threat scenario corresponds to more than one attack path, the associated attack feasibility ratings can be appropriately aggregated (e.g. the threat scenario is assigned the maximum of the attack feasibility ratings).\n"
        "[RQ-15-16] The risk value of a threat scenario shall be a value between (and including) 1 and 5, where a value of 1 represents minimal risk.\n"
        "Methods for risk value determination: risk matrices, risk formulas.\n"
        "Work products: [WP-15-07] Risk values."
    ),
    "15.9": (
        "[RQ-15-17] For each threat scenario, considering its risk values, one or more of the following risk treatment option(s) shall be determined: (a) avoiding the risk — removing the risk sources, deciding not to start or continue with the activity that gives rise to the risk; (b) reducing the risk; (c) sharing the risk — through contracts or transferring risk by buying insurance; (d) retaining the risk.\n"
        "The rationales for retaining the risk and sharing the risk are recorded as cybersecurity claims and are subject to cybersecurity monitoring and vulnerability management in accordance with Clause 8.\n"
        "Work products: [WP-15-08] Risk treatment decisions."
    ),
}

# ── Annex F: Impact rating reference tables ──────────────────────────────────

ANNEX_F_TABLES = [
    {
        "table_id": "Table F.1",
        "title": "Safety impact rating criteria",
        "description": "Safety impact criteria mapped from ISO 26262-3:2018",
        "rows": [
            {"rating": "Severe", "criteria": "S3: Life-threatening injuries (survival uncertain), fatal injuries"},
            {"rating": "Major", "criteria": "S2: Severe and life-threatening injuries (survival probable)"},
            {"rating": "Moderate", "criteria": "S1: Light and moderate injuries"},
            {"rating": "Negligible", "criteria": "S0: No injuries"},
        ],
    },
    {
        "table_id": "Table F.2",
        "title": "Financial impact rating criteria",
        "rows": [
            {"rating": "Severe", "criteria": "The financial damage leads to catastrophic consequences which the affected road user might not overcome."},
            {"rating": "Major", "criteria": "The financial damage leads to substantial consequences which the affected road user will be able to overcome."},
            {"rating": "Moderate", "criteria": "The financial damage leads to inconvenient consequences which the affected road user will be able to overcome with limited resources."},
            {"rating": "Negligible", "criteria": "The financial damage leads to no effect, negligible consequences or is irrelevant to the road user."},
        ],
    },
    {
        "table_id": "Table F.3",
        "title": "Operational impact rating criteria",
        "rows": [
            {"rating": "Severe", "criteria": "Loss or impairment of a core vehicle function. Example: Vehicle not working or unexpected behaviour of core functions such as enabling limp home mode."},
            {"rating": "Major", "criteria": "Loss or impairment of an important vehicle function. Example: Significant annoyance of the driver."},
            {"rating": "Moderate", "criteria": "Partial degradation of a vehicle function. Example: User satisfaction negatively affected."},
            {"rating": "Negligible", "criteria": "No impairment or non-perceivable impairment of a vehicle function."},
        ],
    },
    {
        "table_id": "Table F.4",
        "title": "Privacy impact rating criteria",
        "rows": [
            {"rating": "Severe", "criteria": "Significant or even irreversible impact to the road user. Information is highly sensitive and easy to link to a PII principal."},
            {"rating": "Major", "criteria": "Serious impact to the road user. Information is: (a) highly sensitive and difficult to link to a PII principal, or (b) sensitive and easy to link to a PII principal."},
            {"rating": "Moderate", "criteria": "Inconvenient consequences to the road user. Information is: (a) sensitive but difficult to link to a PII principal, or (b) not sensitive but easy to link to a PII principal."},
            {"rating": "Negligible", "criteria": "No effect, negligible consequences or irrelevant. Information is not sensitive and difficult to link to a PII principal."},
        ],
    },
]

# ── Annex G: Attack feasibility rating reference tables ──────────────────────

ANNEX_G_TABLES = [
    {
        "table_id": "Table G.1",
        "title": "Elapsed time",
        "factor": "elapsed_time",
        "levels": [
            {"label": "<=1 day", "value": 0},
            {"label": "<=1 week", "value": 1},
            {"label": "<=1 month", "value": 4},
            {"label": "<=6 months", "value": 17},
            {"label": ">6 months", "value": 19},
        ],
    },
    {
        "table_id": "Table G.2",
        "title": "Specialist expertise",
        "factor": "specialist_expertise",
        "levels": [
            {"label": "Layman", "value": 0, "description": "Unknowledgeable compared to experts, with no particular expertise. Example: Ordinary person using step-by-step descriptions of an attack that is publicly available."},
            {"label": "Proficient", "value": 3, "description": "Knowledgeable, familiar with the security behaviour of the product or system type. Example: Experienced owner, ordinary technician knowing simple attacks like odometer tuning."},
            {"label": "Expert", "value": 6, "description": "Familiar with underlying algorithms, protocols, hardware, structures, security behaviour, principles and concepts, techniques and tools for defining new attacks. Example: Experienced technician or engineer."},
            {"label": "Multiple experts", "value": 8, "description": "Different fields of expertise required at expert level for distinct steps of an attack. Example: Multiple highly experienced engineers with expertise in different fields."},
        ],
    },
    {
        "table_id": "Table G.3",
        "title": "Knowledge of the item or component",
        "factor": "knowledge_of_item",
        "levels": [
            {"label": "Public information", "value": 0, "description": "Public information concerning the item or component (e.g. as gained from the Internet). Example: Information published on the product homepage or internet forum."},
            {"label": "Restricted information", "value": 3, "description": "Restricted information concerning the item or component (e.g. knowledge controlled within developer organization, shared under NDA). Example: Internal documentation shared between manufacturer and supplier."},
            {"label": "Confidential information", "value": 7, "description": "Confidential information about the item or component (e.g. knowledge shared between discrete teams, access constrained to team members). Example: Immobilizer-related information, software source code."},
            {"label": "Strictly confidential information", "value": 11, "description": "Strictly confidential information (e.g. known by only a few individuals, access very tightly controlled). Example: Customer specific calibrations or memory maps."},
        ],
    },
    {
        "table_id": "Table G.4",
        "title": "Window of opportunity",
        "factor": "window_of_opportunity",
        "levels": [
            {"label": "Unlimited", "value": 0, "description": "High availability via public/untrusted network without time limitation. Remote access or unlimited physical access. Example: Remote attack via cellular interface, unlimited physical access by owner."},
            {"label": "Easy", "value": 1, "description": "High availability and limited access time. Remote access without physical presence. Example: Bluetooth pairing time, remote software update, remote attack requiring vehicle standing still."},
            {"label": "Moderate", "value": 4, "description": "Low availability. Limited physical and/or logical access. Physical access to vehicle interior/exterior without special tools. Example: Attacker enters unlocked car, access via OBD port."},
            {"label": "Difficult", "value": 10, "description": "Very low availability. Impractical level of access. Example: Decapping an IC, cracking a cryptographic key by brute force faster than key rotation."},
        ],
    },
    {
        "table_id": "Table G.5",
        "title": "Equipment",
        "factor": "equipment",
        "levels": [
            {"label": "Standard", "value": 0, "description": "Readily available to the attacker. Part of the product itself or readily obtained. Example: Laptop, CAN adapter, OBD dongle, screwdriver, soldering iron."},
            {"label": "Specialized", "value": 4, "description": "Not readily available but can be acquired without undue effort. Moderate amounts of equipment or extensive attack scripts. Example: Hardware debugging device, HiL test rig, high-grade oscilloscope, signal generator."},
            {"label": "Bespoke", "value": 7, "description": "Specially produced, not readily available to the public, or very expensive. Example: Manufacturer-restricted tools, electron microscope."},
            {"label": "Multiple bespoke", "value": 9, "description": "Different types of bespoke equipment required for distinct steps of an attack."},
        ],
    },
    {
        "table_id": "Table G.6",
        "title": "Attack potential aggregation — numeric values",
        "description": "Sum all factor values to get attack potential. Based on ISO/IEC 18045.",
        "summary": {
            "elapsed_time": {"<=1 day": 0, "<=1 week": 1, "<=1 month": 4, "<=6 months": 17, ">6 months": 19},
            "specialist_expertise": {"Layman": 0, "Proficient": 3, "Expert": 6, "Multiple experts": 8},
            "knowledge_of_item": {"Public": 0, "Restricted": 3, "Confidential": 7, "Strictly confidential": 11},
            "window_of_opportunity": {"Unlimited": 0, "Easy": 1, "Moderate": 4, "Difficult": 10},
            "equipment": {"Standard": 0, "Specialized": 4, "Bespoke": 7, "Multiple bespoke": 9},
        },
    },
    {
        "table_id": "Table G.7",
        "title": "Attack potential to feasibility mapping",
        "description": "Maps sum of attack potential factors to feasibility rating",
        "mapping": [
            {"range": "0-9", "feasibility": "High"},
            {"range": "10-13", "feasibility": "High"},
            {"range": "14-19", "feasibility": "Medium"},
            {"range": "20-24", "feasibility": "Low"},
            {"range": ">=25", "feasibility": "Very low"},
        ],
    },
    {
        "table_id": "Table G.8",
        "title": "CVSS exploitability to feasibility mapping",
        "description": "Maps CVSS exploitability values (E = 8.22 x V x C x P x U) to feasibility",
        "formula": "E = 8.22 x V x C x P x U, where V=attack_vector (0.2-0.85), C=attack_complexity (0.44-0.77), P=privileges_required (0.27-0.85), U=user_interaction (0.62-0.85). Range: 0.12-3.89.",
        "mapping": [
            {"range": "2.96-3.89", "feasibility": "High"},
            {"range": "2.00-2.95", "feasibility": "Medium"},
            {"range": "1.06-1.99", "feasibility": "Low"},
            {"range": "0.12-1.05", "feasibility": "Very low"},
        ],
    },
    {
        "table_id": "Table G.9",
        "title": "Attack vector-based feasibility approach",
        "description": "Simplified approach suitable for concept phase when insufficient information for detailed attack paths",
        "mapping": [
            {"vector": "Network", "feasibility": "High", "description": "Potential attack path bound to network stack without limitation. Example: Cellular network making ECU directly accessible on internet."},
            {"vector": "Adjacent", "feasibility": "Medium", "description": "Attack path bound to network stack but connection limited physically or logically. Example: Bluetooth interface, VPN connection."},
            {"vector": "Local", "feasibility": "Low", "description": "Attack path not bound to network stack; requires direct access. Example: USB mass storage device, memory card."},
            {"vector": "Physical", "feasibility": "Very low", "description": "Requires physical access to realize the attack path."},
        ],
    },
]

# ── Annex H: Worked TARA example — headlamp system ──────────────────────────

ANNEX_H_NORMATIVE = (
    "EXAMPLE TARA: Headlamp System\n\n"
    "Item definition: The headlamp system turns on/off the headlamp in accordance with the switch by demand of the driver. "
    "If the headlamp is in high-beam mode, the headlamp system switches automatically to low-beam when an oncoming vehicle "
    "is detected, and returns to high-beam when the oncoming vehicle is no longer detected.\n\n"
    "Operational environment: Connected to gateway ECU, which connects to navigation ECU. Navigation ECU has Bluetooth and "
    "cellular interfaces with firewall. Gateway ECU has OBD-II interface with strong security controls (CAL4).\n\n"
    "STEP 1 — Asset Identification (Table H.2):\n"
    "- Data communication (lamp request): Integrity, Availability. Damage: vehicle cannot be driven at night; front collision with stationary object.\n"
    "- Data communication (oncoming car info): Integrity, Availability. Damage: oncoming drivers blinded; malfunctioning automatic high beam.\n"
    "- Firmware of body control ECU: Confidentiality, Integrity.\n\n"
    "STEP 2 — Impact Rating (Table H.3):\n"
    "- Vehicle cannot be driven at night → Operational: Major\n"
    "- Front collision with stationary object at medium speed → Safety: Severe (S3)\n"
    "- Malfunctioning automatic high beam → Operational: Moderate\n\n"
    "STEP 3 — Threat Scenario Identification (Table H.4):\n"
    "- Spoofing of lamp request signal → loss of integrity → headlamp turns off unintentionally\n"
    "- Tampering with signal from body control ECU → loss of integrity → headlamp turns off unintentionally\n"
    "- DoS of oncoming car information → loss of availability → headlamp always low beam\n\n"
    "STEP 4 — Attack Path Analysis (Table H.5):\n"
    "Path A: Attacker compromises navigation ECU via cellular → malicious control signals → gateway forwards → spoofs lamp request (OFF)\n"
    "Path B: Attacker compromises navigation ECU via Bluetooth → same chain\n"
    "Path C: Attacker gets local access to OBD connector → sends malicious signals → gateway forwards → spoofs lamp request (OFF)\n"
    "Path D: Attacker compromises navigation ECU via cellular → floods communication bus → DoS of oncoming car info\n"
    "Path E: Attacker attaches BT OBD dongle → compromises smartphone → sends via BT dongle → gateway forwards → floods bus\n\n"
    "STEP 5 — Attack Feasibility Rating:\n"
    "Attack vector-based (Table H.6): Path A (cellular) = High; Path B (Bluetooth) = Medium; Path C (OBD) = Low\n"
    "Attack potential-based (Table H.7): DoS via cellular: ET=1, SE=8, KoIC=7, WoO=0, Eq=4, Sum=20 → Low; "
    "DoS via BT dongle: ET=1, SE=8, KoIC=7, WoO=4, Eq=4, Sum=24 → Low\n\n"
    "STEP 6 — Risk Value Determination (Table H.8 risk matrix):\n"
    "Matrix: Impact(Severe) x Feasibility(High) = Risk 5; Impact(Moderate) x Feasibility(Low) = Risk 2\n"
    "Results: Spoofing of lamp request (Severe, High) → Risk 5; DoS of oncoming car info (Moderate, Low) → Risk 2\n"
    "Formula alternative: R = 1 + I x F (where I and F are numerical values from Table H.10)\n\n"
    "STEP 7 — Risk Treatment Decision (Table H.11):\n"
    "- Spoofing of lamp request: Risk 5 → Reducing the risk\n"
    "- DoS of oncoming car info: Risk 2 → Reducing the risk"
)

ANNEX_H_TABLES = [
    {
        "table_id": "Table H.2",
        "title": "Assets and damage scenarios",
        "rows": [
            {"asset": "Data communication (lamp request)", "properties": "I, A", "damage": "Vehicle cannot be driven at night; Front collision with stationary object caused by unintended headlamp off"},
            {"asset": "Data communication (oncoming car info)", "properties": "I, A", "damage": "Oncoming drivers blinded; Malfunctioning automatic high beam always low"},
            {"asset": "Firmware of body control ECU", "properties": "C, I", "damage": "..."},
        ],
    },
    {
        "table_id": "Table H.3",
        "title": "Impact ratings for damage scenarios",
        "rows": [
            {"damage": "Vehicle cannot be driven at night", "category": "O", "rating": "Major"},
            {"damage": "Front collision with stationary object at medium speed", "category": "S", "rating": "Severe (S3)"},
            {"damage": "Malfunctioning automatic high beam always low", "category": "O", "rating": "Moderate"},
        ],
    },
    {
        "table_id": "Table H.8",
        "title": "Risk matrix example",
        "description": "Impact x Feasibility → Risk value (1-5)",
        "matrix": {
            "headers": ["Very Low", "Low", "Medium", "High"],
            "rows": [
                {"impact": "Severe", "values": [2, 3, 4, 5]},
                {"impact": "Major", "values": [1, 2, 3, 4]},
                {"impact": "Moderate", "values": [1, 2, 2, 3]},
                {"impact": "Negligible", "values": [1, 1, 1, 1]},
            ],
        },
    },
    {
        "table_id": "Table H.10",
        "title": "Numerical values for risk formula R = 1 + I x F",
        "impact_values": {"Negligible": 0, "Moderate": 1, "Major": 1.5, "Severe": 2},
        "feasibility_values": {"Very low": 0, "Low": 1, "Medium": 1.5, "High": 2},
    },
]


def main():
    with open(SEED_PATH) as f:
        data = json.load(f)

    updated = 0
    for clause in data["clauses"]:
        if clause["standard"] != "iso_21434":
            continue

        cid = clause["clause_id"]

        # Add normative text for Clause 15 sub-clauses
        if cid in NORMATIVE:
            clause["normative_text"] = NORMATIVE[cid]
            updated += 1

        # Add Annex F reference tables
        if cid == "Annex F":
            clause["title"] = "Guidelines for impact rating"
            clause["reference_tables"] = ANNEX_F_TABLES
            clause["normative_text"] = (
                "Annex F provides example criteria for impact rating (see 15.5) for damage scenarios "
                "involving safety, financial, operational and privacy damage. The tables (Table F.1 through "
                "Table F.4) can be used for impact rating.\n\n"
                "Considerations on how the scalability of damage (impact to multiple road users in a single "
                "damage scenario) modify the impact rating have not been included, but can be added to "
                "organization-specific rating criteria."
            )
            updated += 1

        # Add Annex G reference tables
        if cid == "Annex G":
            clause["title"] = "Guidelines for attack feasibility rating"
            clause["reference_tables"] = ANNEX_G_TABLES
            clause["normative_text"] = (
                "Annex G provides guidelines on applying three approaches for attack feasibility rating (see 15.7): "
                "attack potential-based (G.2), CVSS-based (G.3), and attack vector-based (G.4).\n\n"
                "Attack potential is defined in ISO/IEC 18045 as a measure of the effort to be expended in attacking "
                "an item or component, expressed in terms of an attacker's expertise and resources. It relies on five "
                "core parameters: elapsed time, specialist expertise, knowledge of the item or component, window of "
                "opportunity, and equipment.\n\n"
                "The sum of all factor scores produces an attack potential value (Table G.6). Ranges map to feasibility "
                "levels (Table G.7): 0-9 = High, 10-13 = High, 14-19 = Medium, 20-24 = Low, >=25 = Very low.\n\n"
                "The CVSS-based approach uses exploitability metrics: E = 8.22 x V x C x P x U (Table G.8).\n\n"
                "The attack vector-based approach is a simplified method suitable for the concept phase when "
                "insufficient information is available for detailed attack paths (Table G.9)."
            )
            updated += 1

        # Add Annex H worked example
        if cid == "Annex H":
            clause["title"] = "Examples of application of TARA methods — headlamp system"
            clause["normative_text"] = ANNEX_H_NORMATIVE
            clause["reference_tables"] = ANNEX_H_TABLES
            updated += 1

    with open(SEED_PATH, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"Updated {updated} ISO 21434 clauses in {SEED_PATH}")


if __name__ == "__main__":
    main()
