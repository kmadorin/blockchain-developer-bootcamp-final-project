// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ILimitOrderProtocol {
    struct Order {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        bytes makerAssetData; // (transferFrom.selector, signer, ______, makerAmount, ...)
        bytes takerAssetData; // (transferFrom.selector, sender, signer, takerAmount, ...)
        bytes getMakerAmount; // this.staticcall(abi.encodePacked(bytes, swapTakerAmount)) => (swapMakerAmount)
        bytes getTakerAmount; // this.staticcall(abi.encodePacked(bytes, swapMakerAmount)) => (swapTakerAmount)
        bytes predicate;      // this.staticcall(bytes) => (bool)
        bytes permit;         // On first fill: permit.1.call(abi.encodePacked(permit.selector, permit.2))
        bytes interaction;
    }

    function getMakerAmount(
        uint256 orderMakerAmount,
        uint256 orderTakerAmount,
        uint256 swapTakerAmount
    ) external returns (uint256);

    function getTakerAmount(
        uint256 orderMakerAmount,
        uint256 orderTakerAmount,
        uint256 swapMakerAmount
    ) external returns (uint256);

    function fillOrder(Order memory order, bytes calldata signature, uint256 makingAmount, uint256 takingAmount, uint256 thresholdAmount) external returns(uint256, uint256);
    function lt(uint256 value, address target, bytes memory data) external view returns(bool);

    /// @notice Performs an arbitrary call to target with data
    /// @return Result bytes transmuted to uint256
    function arbitraryStaticCall(address target, bytes memory data) external view returns(uint256);
}
