# Vamalio Technologies — IP Evidence Notice

**Evidence date:** 12 September 2026  
**Status:** Confidential development record  
**Copyright:** © 2026 Vamalio Technologies. All rights reserved.

This repository contains proprietary Vamalio Technologies software, demonstrations, workflow designs, product copy, architecture and implementation materials relating to the Vamalio Capacity Recovery Engine and its product implementations including RecoveryFlow and DentalFlow.

The core concept is a reusable operational capacity-recovery engine that reacts to cancellations, late cancellations and no-shows; recalculates the remaining usable capacity window; determines which organisation-permitted appointment or activity types can still fit; evaluates practical attendance/arrival feasibility; coordinates timed multi-channel offers; locks the first valid acceptance; writes the outcome back to the source system; and records an auditable recovery event.

Public demonstrations intentionally omit confidential implementation detail, including exact scoring weights, optimisation rules, concurrency controls, vendor-specific mappings and customer-specific business rules.

Vamalio products are designed to integrate with existing systems rather than replace them. Preferred integration patterns include authorised vendor APIs/webhooks, FHIR/SMART-on-FHIR where appropriate, HL7 interfaces, secure queues and controlled file exchange. Transport coordination is only performed where an authorised provider interface and an existing lawful transport dependency/entitlement are available; otherwise the workflow escalates to staff.

Historical repository names and some early commit messages may contain the legacy spelling “Vermalio”. The current public brand is **Vamalio Technologies**.

No licence to copy, reproduce, reverse engineer, distribute or create derivative commercial products is granted merely by access to this repository, a demonstration or related documentation.

© 2026 Vamalio Technologies. All rights reserved.