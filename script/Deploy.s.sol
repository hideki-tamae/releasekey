// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../src/Counter.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        Counter counter = new Counter();
        console.log("Counter deployed at:", address(counter));
        console.log("chain id:", block.chainid);

        vm.stopBroadcast();
    }
}
