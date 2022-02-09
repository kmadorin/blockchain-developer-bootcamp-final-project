// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../libraries/ArgumentsDecoder.sol";
import "../interfaces/InteractiveNotificationReceiver.sol";
import "./EIP712Alien.sol";
import "hardhat/console.sol";

abstract contract LimitOrderProtocolBase is InteractiveNotificationReceiver, EIP712Alien {
    // Fixed-size order part with core information
    struct StaticOrder {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;  // equals to Zero address on public orders
        uint256 makingAmount;
        uint256 takingAmount;
    }

    // `StaticOrder` extension including variable-sized additional order meta information
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        address maker;
        address receiver;
        address allowedSender;  // equals to Zero address on public orders
        uint256 makingAmount;
        uint256 takingAmount;
        bytes makerAssetData;
        bytes takerAssetData;
        bytes getMakerAmount; // this.staticcall(abi.encodePacked(bytes, swapTakerAmount)) => (swapMakerAmount)
        bytes getTakerAmount; // this.staticcall(abi.encodePacked(bytes, swapMakerAmount)) => (swapTakerAmount)
        bytes predicate;      // this.staticcall(bytes) => (bool)
        bytes permit;         // On first fill: permit.1.call(abi.encodePacked(permit.selector, permit.2))
        bytes interaction;
    }


    bytes32 constant public LIMIT_ORDER_TYPEHASH = keccak256(
        "Order(uint256 salt,address makerAsset,address takerAsset,address maker,address receiver,address allowedSender,uint256 makingAmount,uint256 takingAmount,bytes makerAssetData,bytes takerAssetData,bytes getMakerAmount,bytes getTakerAmount,bytes predicate,bytes permit,bytes interaction)"
    );

    address public immutable LIMIT_ORDER_PROTOCOL;

    constructor(address _limitOrderProtocol)
    EIP712Alien(_limitOrderProtocol, "1inch Limit Order Protocol", "2") {
        LIMIT_ORDER_PROTOCOL = _limitOrderProtocol;
    }

    function _toUint256(bytes memory _bytes) internal pure returns (uint256 value) {
        assembly {
            value := mload(add(_bytes, 0x20))
        }
    }

    /// @notice callback from limit order protocol, executes on order fill
    function notifyFillOrder(
        address taker,
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes memory interactiveData
    ) external virtual override;

    /// @notice validate signature from Limit Order Protocol, checks also asset and amount consistency
    function isValidSignature(bytes32 hash, bytes memory signature) external virtual view returns (bytes4);

    function hashOrder(
        StaticOrder memory staticOrder,
        bytes memory makerAssetData,
        bytes memory takerAssetData,
        bytes memory getMakerAmount,
        bytes memory getTakerAmount,
        bytes memory predicate,
        bytes memory permit,
        bytes memory interaction) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LIMIT_ORDER_TYPEHASH,
                    staticOrder,
                    keccak256(makerAssetData),
                    keccak256(takerAssetData),
                    keccak256(getMakerAmount),
                    keccak256(getTakerAmount),
                    keccak256(predicate),
                    keccak256(permit),
                    keccak256(interaction)
                )
            )
        );
    }
}
