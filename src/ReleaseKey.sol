// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Minimal commitment log for consent-gated record release.
/// The contract never stores record content or personal data — only a
/// salted commitment, a salted recipient commitment, and coarse lifecycle
/// events (Created / Approved / Revoked).
///
/// Core invariant: the AGENT_ROLE wallet can only create commitments. Only
/// the APPROVER_ROLE wallet — which acts after a backend has validated a
/// fresh World ID verification — can approve a release or revoke it. The
/// agent can never approve its own release.
contract ReleaseKey is AccessControl {
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    bytes32 public constant APPROVER_ROLE = keccak256("APPROVER_ROLE");

    uint64 public constant MAX_TTL_SECONDS = 1 hours;

    enum Status {
        None,
        Created,
        Approved,
        Revoked
    }

    struct Record {
        bytes32 commitment;
        bytes32 recipientCommitment;
        uint64 approvedUntil; // 0 until approved
        Status status;
    }

    mapping(bytes32 => Record) public records;
    mapping(bytes32 => bool) public usedVerification;

    event Created(bytes32 indexed recordId);
    event Approved(bytes32 indexed recordId, uint64 approvedUntil);
    event Revoked(bytes32 indexed recordId);

    error InvalidStatus();
    error VerificationAlreadyUsed();
    error InvalidTtl();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createCommitment(bytes32 recordId, bytes32 commitment, bytes32 recipientCommitment)
        external
        onlyRole(AGENT_ROLE)
    {
        if (records[recordId].status != Status.None) revert InvalidStatus();

        records[recordId] = Record({
            commitment: commitment,
            recipientCommitment: recipientCommitment,
            approvedUntil: 0,
            status: Status.Created
        });

        emit Created(recordId);
    }

    function approveRelease(bytes32 recordId, bytes32 verificationRef, uint64 ttlSeconds)
        external
        onlyRole(APPROVER_ROLE)
    {
        if (records[recordId].status != Status.Created) revert InvalidStatus();
        if (usedVerification[verificationRef]) revert VerificationAlreadyUsed();
        if (ttlSeconds == 0 || ttlSeconds > MAX_TTL_SECONDS) revert InvalidTtl();

        usedVerification[verificationRef] = true;

        uint64 approvedUntil = uint64(block.timestamp) + ttlSeconds;
        records[recordId].approvedUntil = approvedUntil;
        records[recordId].status = Status.Approved;

        emit Approved(recordId, approvedUntil);
    }

    function revoke(bytes32 recordId) external onlyRole(APPROVER_ROLE) {
        Status status = records[recordId].status;
        if (status != Status.Created && status != Status.Approved) revert InvalidStatus();

        records[recordId].status = Status.Revoked;

        emit Revoked(recordId);
    }

    function isReleasable(bytes32 recordId) external view returns (bool) {
        Record storage r = records[recordId];
        return r.status == Status.Approved && block.timestamp <= r.approvedUntil;
    }
}
