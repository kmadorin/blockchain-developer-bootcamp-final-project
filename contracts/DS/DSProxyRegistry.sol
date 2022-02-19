// SPDX-License-Identifier: AGPL-3.0-or-later

/// ProxyRegistry.sol

// Copyright (C) 2018-2021 Dai Foundation

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity >=0.5.0;

import './DSProxy.sol';
import './SmartWallet.sol';
import './DSProxyFactory.sol';
import 'hardhat/console.sol';

// This Registry deploys new proxy instances through DSProxyFactory.build(address) and keeps a registry of owner => proxy
contract DSProxyRegistry {
    mapping(address => SmartWallet) public wallets;
    DSProxyFactory factory;

    constructor(address factory_) {
        factory = DSProxyFactory(factory_);
    }

    // deploys a new proxy instance
    // sets owner of proxy to caller
    function build() public returns (address payable wallet) {
        wallet = build(msg.sender);
    }

    // deploys a new proxy instance
    // sets custom owner of proxy
    function build(address owner) public returns (address payable wallet) {
        require(wallets[owner] == SmartWallet(payable(address(0))) || wallets[owner].owner() != owner); // Not allow new proxy if the user already has one and remains being the owner
        wallet = factory.build(owner);
        wallets[owner] = SmartWallet(wallet);
    }
}
