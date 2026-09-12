# Vamalio Capacity Recovery Platform — Integration Architecture

© 2026 Vamalio Technologies. All rights reserved.

## Purpose
One shared recovery engine supports DentalFlow, RecoveryFlow and future capacity-recovery products. It is designed as an action/orchestration layer around an organisation's existing source system rather than a replacement patient/customer database.

## Trial modes
### 1. Demo
Synthetic data, simulated communications, simulated source/write-back and simulated transport. No real patient data.

### 2. Controlled pilot
Approved test or limited live data, restricted authorised users, defined candidate eligibility supplied by the source organisation, optional live SMS/voice, and either manual or approved automatic write-back.

### 3. Live integration
Customer-specific API credentials, production data-processing arrangements, information-governance/security approval, role-based access, persistent audit storage, monitoring, and appropriate clinical-safety controls for healthcare deployments.

## Adapter contracts
### Source adapter
- receive/detect cancellation, released capacity or no-show event
- retrieve only source-eligible candidates and operational attributes required for the event
- retrieve one candidate by identifier
- confirm/write back a successful booking where permitted

### Communications adapter
- send SMS offer
- send automated voice offer with DTMF/voice response
- send email offer
- receive inbound responses through authenticated provider webhooks
- delivery/bounce/failure status

### Transport adapter
- consume existing transport entitlement/requirement supplied by the source system
- check mobilisation and journey feasibility against required arrival time
- optionally reserve/request transport where an approved provider API exists
- release a reservation if the appointment offer expires or another candidate wins
- otherwise create a human escalation task

### Audit adapter
- recovery event created
- candidate evaluation/ranking
- transport checks
- offers sent
- patient responses
- first valid acceptance lock
- write-back result
- human escalation

## Supported integration patterns
The platform is vendor-neutral. A customer-specific adapter can use one or more of:
- REST/JSON APIs
- FHIR APIs and resources where appropriate
- HL7 messages/interface engines
- webhooks/event feeds
- SFTP/approved file feeds for controlled pilots where no live API exists
- manual receptionist/operator trigger as a low-risk first pilot

## Core recovery sequence
1. Source system reports capacity event.
2. Source system supplies clinically/operationally eligible candidates.
3. Recovery engine calculates usable remaining capacity (including late/no-show residual time).
4. It evaluates duration/resource fit, timing, travel and existing transport dependency.
5. Configured policy ranks feasible candidates.
6. Timed offers are sent by SMS/voice/email.
7. First valid acceptance is atomically locked in production storage.
8. Competing offers close.
9. Transport is confirmed/reserved if required and supported.
10. Confirmed booking is written back to the source system, or routed to authorised staff for one-click/manual confirmation if write access is unavailable.
11. Full outcome and metrics are written to the audit store.

## Clinical boundary
Vamalio must not independently determine clinical eligibility. NHS/dental source systems and authorised clinical rules remain authoritative. The engine optimises the operational use of capacity among candidates already permitted for consideration.

## Production requirements not present in the synthetic console
- customer/API credentials and vendor approval
- encrypted secret management
- persistent production data/audit storage
- atomic acceptance locking/transaction control
- identity/SSO/RBAC
- monitoring, backups and alerting
- signed/verified webhooks
- consent/contact-policy configuration
- NHS information governance, DPIA, DSPT/DTAC considerations and clinical-safety work where applicable
- organisation-specific data retention/deletion policy

## Current repository components
- `src/capacity-recovery-engine.js` — shared recovery domain logic
- `public/capacity-console.html` — unified desktop/tablet trial console
- `public/capacity-console.js` — synthetic cross-sector trial logic
- `public/dentalflow.html` / `public/dentalflow-demo.html` — DentalFlow product/demo
- `public/recoveryflow.html` / `public/recoveryflow-demo.html` — RecoveryFlow product/demo

This document records the intended integration design as of 12 September 2026 and should be updated as adapters are implemented.
