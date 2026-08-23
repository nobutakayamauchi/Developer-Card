# Public/Core Contract v1

Public surface may send only owner-authorized evidence descriptors and receive only public-safe result fields.

## Request
```json
{
  "contract_version":"1.0",
  "analysis_tier":"FV|DEEP|FULL",
  "owner_handle":"string",
  "evidence_snapshot_id":"string",
  "repositories":[
    {"full_name":"owner/repo","authorization":"SHOWCASE_AND_EVALUATE|EVALUATE_ONLY|EXCLUDE","head_sha":"optional"}
  ]
}
```

## FV response
```json
{
  "contract_version":"1.0",
  "tier":"FV",
  "developer_type":"string",
  "highlights":["string"],
  "recommended_repos":[{"full_name":"owner/repo","reason":"string"}],
  "curiosity_signals":[{"label":"string","state":"CANDIDATE_REQUIRES_DEEP_ANALYSIS"}],
  "snapshot_id":"string"
}
```

## Non-negotiable filters
- EXCLUDE repo data is rejected at ingress and absent from all outputs.
- EVALUATE_ONLY repo identity is absent from public output.
- PRIVATE_ONLY findings never cross this contract.
- Paid entitlement never mutates authorization state.
- Public response cannot claim a Tech Radar, research, commercialization, or exposure conclusion unless that paid analysis actually ran.

FV currently executes locally with public static metadata. The contract exists now so a later private Core service can replace the evaluator without changing the public product flow.