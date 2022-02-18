// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./DSProxy.sol";
import "../helpers/LimitOrderProtocolBase.sol";
import "hardhat/console.sol";

contract SmartWallet is DSProxy, LimitOrderProtocolBase {
    using ArgumentsDecoder for bytes;

    constructor(address cacheAddr, address limitOrderProtocol)
    LimitOrderProtocolBase(limitOrderProtocol) DSProxy(cacheAddr) {}

    function setAuthorityByAddress(address _authority) public auth {
        setAuthority(DSAuthority(_authority));
    }

    function notifyFillOrder(
        address taker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes calldata interactiveData
    ) external override {
        require(msg.sender == LIMIT_ORDER_PROTOCOL, "only LOP can exec callback");
        makerAsset;
        takingAmount;
        address _target;
        bytes memory _calldata;

        IERC20(makerAsset).approve(msg.sender, 1);
        (_target, _calldata) = interactiveData.decodeTargetAndCalldata();
        _target.call(_calldata);
//        execute(_target, _calldata);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external override view returns (bytes4) {
        StaticOrder memory staticOrder = readStaticOrder(signature);

        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            makerAssetData := add(add(signature, 64), mload(add(signature, 320)))
            takerAssetData := add(add(signature, 64), mload(add(signature, 352)))
            _getMakerAmount := add(add(signature, 64), mload(add(signature, 384)))
            _getTakerAmount := add(add(signature, 64), mload(add(signature, 416)))
            predicate := add(add(signature, 64), mload(add(signature, 448)))
            permit := add(add(signature, 64), mload(add(signature, 480)))
            interaction := add(add(signature, 64), mload(add(signature, 512)))
        }

        require(
            hashOrder(staticOrder, makerAssetData, takerAssetData, _getMakerAmount, _getTakerAmount, predicate, permit, interaction) == hash,
            "Smart wallet: bad order"
        );

        return this.isValidSignature.selector;
    }

    function readSignature(bytes memory signature) external view returns (bytes32) {
        StaticOrder memory staticOrder = readStaticOrder(signature);

        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            makerAssetData := add(add(signature, 64), mload(add(signature, 320)))
            takerAssetData := add(add(signature, 64), mload(add(signature, 352)))
            _getMakerAmount := add(add(signature, 64), mload(add(signature, 384)))
            _getTakerAmount := add(add(signature, 64), mload(add(signature, 416)))
            predicate := add(add(signature, 64), mload(add(signature, 448)))
            permit := add(add(signature, 64), mload(add(signature, 480)))
            interaction := add(add(signature, 64), mload(add(signature, 512)))
        }

        //        console.log('interaction', string(interaction));
        //         return interaction;
        return hashOrder(staticOrder, makerAssetData, takerAssetData, _getMakerAmount, _getTakerAmount, predicate, permit, interaction);
    }

    function readStaticOrder(bytes memory signature) public pure returns (StaticOrder memory) {
        StaticOrder memory staticOrder;
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;
        // equals to Zero address on public orders
        uint256 makingAmount;
        uint256 takingAmount;

        assembly {// solhint-disable-line no-inline-assembly
            salt := mload(add(signature, 64))
            makerAsset := mload(add(signature, 96))
            takerAsset := mload(add(signature, 128))
            maker := mload(add(signature, 160))
            receiver := mload(add(signature, 192))
            allowedSender := mload(add(signature, 224))
            makingAmount := mload(add(signature, 256))
            takingAmount := mload(add(signature, 288))
        }

        staticOrder.salt = salt;
        staticOrder.makerAsset = makerAsset;
        staticOrder.takerAsset = takerAsset;
        staticOrder.maker = maker;
        staticOrder.receiver = receiver;
        staticOrder.allowedSender = allowedSender;
        staticOrder.makingAmount = makingAmount;
        staticOrder.takingAmount = takingAmount;

        return staticOrder;
    }
}
