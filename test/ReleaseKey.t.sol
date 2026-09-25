// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ReleaseKey} from "../src/ReleaseKey.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract ReleaseKeyTest is Test {
    ReleaseKey internal releaseKey;

    address internal admin = makeAddr("admin");
    address internal agent = makeAddr("agent");
    address internal approver = makeAddr("approver");
    address internal stranger = makeAddr("stranger");

    bytes32 internal recordId = keccak256("record-1");
    bytes32 internal commitment = keccak256("commitment-1");
    bytes32 internal recipientCommitment = keccak256("recipient-1");
    bytes32 internal verificationRef = keccak256("verification-1");

    // Cached so that reading them never becomes the "next call" that a
    // single-shot vm.prank() would otherwise be consumed by.
    bytes32 internal agentRole;
    bytes32 internal approverRole;

    function setUp() public {
        vm.startPrank(admin);
        releaseKey = new ReleaseKey(admin);
        agentRole = keccak256("AGENT_ROLE");
        approverRole = keccak256("APPROVER_ROLE");
        releaseKey.grantRole(agentRole, agent);
        releaseKey.grantRole(approverRole, approver);
        vm.stopPrank();
    }

    function _create() internal {
        vm.prank(agent);
        releaseKey.createCommitment(recordId, commitment, recipientCommitment);
    }

    // --- create ---

    function test_AgentCanCreate() public {
        _create();
        (,, uint64 approvedUntil, ReleaseKey.Status status) = releaseKey.records(recordId);
        assertEq(uint8(status), uint8(ReleaseKey.Status.Created));
        assertEq(approvedUntil, 0);
    }

    function test_NonAgentCannotCreate() public {
        vm.prank(stranger);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, stranger, agentRole
            )
        );
        releaseKey.createCommitment(recordId, commitment, recipientCommitment);
    }

    // --- core invariant: agent cannot approve ---

    function test_AgentCannotApprove() public {
        _create();
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, agent, approverRole
            )
        );
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);
    }

    // --- approve ---

    function test_ApproverCanApproveCreatedRecord() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);

        (,, uint64 approvedUntil, ReleaseKey.Status status) = releaseKey.records(recordId);
        assertEq(uint8(status), uint8(ReleaseKey.Status.Approved));
        assertEq(approvedUntil, uint64(block.timestamp) + 1 hours);
        assertTrue(releaseKey.isReleasable(recordId));
    }

    function test_CannotApproveNoneRecord() public {
        vm.prank(approver);
        vm.expectRevert(ReleaseKey.InvalidStatus.selector);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);
    }

    function test_CannotApproveRevokedRecord() public {
        _create();
        vm.prank(approver);
        releaseKey.revoke(recordId);

        vm.prank(approver);
        vm.expectRevert(ReleaseKey.InvalidStatus.selector);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);
    }

    function test_CannotApproveAlreadyApprovedRecord() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);

        vm.prank(approver);
        vm.expectRevert(ReleaseKey.InvalidStatus.selector);
        releaseKey.approveRelease(recordId, keccak256("verification-2"), 1 hours);
    }

    // --- verification replay ---

    function test_SameVerificationRefCannotBeUsedTwice() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);

        bytes32 recordId2 = keccak256("record-2");
        vm.prank(agent);
        releaseKey.createCommitment(recordId2, commitment, recipientCommitment);

        vm.prank(approver);
        vm.expectRevert(ReleaseKey.VerificationAlreadyUsed.selector);
        releaseKey.approveRelease(recordId2, verificationRef, 1 hours);
    }

    // --- isReleasable ---

    function test_IsReleasableFalseAfterExpiry() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);

        assertTrue(releaseKey.isReleasable(recordId));
        vm.warp(block.timestamp + 1 hours + 1);
        assertFalse(releaseKey.isReleasable(recordId));
    }

    function test_IsReleasableFalseAfterRevoke() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);
        assertTrue(releaseKey.isReleasable(recordId));

        vm.prank(approver);
        releaseKey.revoke(recordId);
        assertFalse(releaseKey.isReleasable(recordId));
    }

    function test_IsReleasableFalseForUncreatedRecord() public {
        assertFalse(releaseKey.isReleasable(recordId));
    }

    // --- revoke ---

    function test_RevokeAllowedFromCreated() public {
        _create();
        vm.prank(approver);
        releaseKey.revoke(recordId);
        (,,, ReleaseKey.Status status) = releaseKey.records(recordId);
        assertEq(uint8(status), uint8(ReleaseKey.Status.Revoked));
    }

    function test_NonApproverCannotRevoke() public {
        _create();
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, agent, approverRole
            )
        );
        releaseKey.revoke(recordId);
    }

    // --- TTL bounds ---

    function test_TtlZeroReverts() public {
        _create();
        vm.prank(approver);
        vm.expectRevert(ReleaseKey.InvalidTtl.selector);
        releaseKey.approveRelease(recordId, verificationRef, 0);
    }

    function test_TtlAboveMaxReverts() public {
        _create();
        vm.prank(approver);
        vm.expectRevert(ReleaseKey.InvalidTtl.selector);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours + 1);
    }

    function test_TtlAtMaxSucceeds() public {
        _create();
        vm.prank(approver);
        releaseKey.approveRelease(recordId, verificationRef, 1 hours);
        assertTrue(releaseKey.isReleasable(recordId));
    }
}
