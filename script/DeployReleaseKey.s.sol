// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ReleaseKey} from "../src/ReleaseKey.sol";

/// @notice Deploys ReleaseKey and grants AGENT_ROLE / APPROVER_ROLE to two
/// distinct wallets, read from the environment. These must never be the
/// same address — that would defeat the core "agent cannot approve"
/// invariant this whole project is built around.
contract DeployReleaseKey is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address agentWallet = vm.envAddress("AGENT_WALLET_ADDRESS");
        address approverWallet = vm.envAddress("APPROVER_WALLET_ADDRESS");

        require(agentWallet != approverWallet, "AGENT and APPROVER wallets must differ");

        vm.startBroadcast(deployerKey);

        ReleaseKey releaseKey = new ReleaseKey(deployer);
        releaseKey.grantRole(releaseKey.AGENT_ROLE(), agentWallet);
        releaseKey.grantRole(releaseKey.APPROVER_ROLE(), approverWallet);

        vm.stopBroadcast();

        console.log("ReleaseKey deployed at:", address(releaseKey));
        console.log("AGENT_ROLE granted to:", agentWallet);
        console.log("APPROVER_ROLE granted to:", approverWallet);
    }
}
