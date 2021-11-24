// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Inchi {
    string private _name = "Inchi";

    function getName() public view returns (string memory) {
        return _name;
    }

    function setName(string calldata newName) external {
        _name = newName;
    }
}
