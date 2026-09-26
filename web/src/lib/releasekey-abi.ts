// Minimal ABI — only the functions this app actually calls.
// Full ABI: `forge inspect ReleaseKey abi` in the repo root.
export const releaseKeyAbi = [
  {
    type: "function",
    name: "createCommitment",
    inputs: [
      { name: "recordId", type: "bytes32" },
      { name: "commitment", type: "bytes32" },
      { name: "recipientCommitment", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approveRelease",
    inputs: [
      { name: "recordId", type: "bytes32" },
      { name: "verificationRef", type: "bytes32" },
      { name: "ttlSeconds", type: "uint64" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revoke",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isReleasable",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "records",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "commitment", type: "bytes32" },
      { name: "recipientCommitment", type: "bytes32" },
      { name: "approvedUntil", type: "uint64" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
] as const;
