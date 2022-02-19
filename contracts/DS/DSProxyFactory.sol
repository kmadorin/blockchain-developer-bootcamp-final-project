// SPDX-License-Identifier: GNU-3

// DSProxyFactory
// This factory deploys new proxy instances through build()
// Deployed proxy addresses are logged
pragma solidity ^0.8.0;

import "./DSProxyCache.sol";
import "./SmartWallet.sol";

contract DSProxyFactory {
    event Created(address indexed sender, address indexed owner, address proxy, address cache);
    mapping(address=>bool) public isProxy;
    DSProxyCache public cache;
    address LIMIT_ORDER_PROTOCOL;

    constructor(address limitOrderProtocol) {
        LIMIT_ORDER_PROTOCOL = limitOrderProtocol;
        cache = new DSProxyCache();
    }

    // deploys a new proxy instance
    // sets owner of proxy to caller
    function build() public returns (address payable proxy) {
        proxy = build(msg.sender);
    }

    // deploys a new proxy instance
    // sets custom owner of proxy
    function build(address owner) public returns (address payable proxy) {
        proxy = payable(new SmartWallet(address(cache), LIMIT_ORDER_PROTOCOL));
        emit Created(msg.sender, owner, address(proxy), address(cache));
        DSProxy(proxy).setOwner(owner);
        isProxy[proxy] = true;
    }
}


