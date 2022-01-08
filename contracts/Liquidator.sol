// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./helpers/AaveBase.sol";
import "./helpers/LimitOrderProtocolBase.sol";
import "./interfaces/ILendingPoolAddressesProvider.sol";


contract Liquidator is LimitOrderProtocolBase, AaveBase, Ownable {
    using SafeERC20 for IERC20;
    using ArgumentsDecoder for bytes;
    using SafeMath for uint256;

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

    mapping(address => Order[]) public orders;
    uint256 public fee;

    constructor(address limitOrderProtocol, ILendingPoolAddressesProvider _lendingPoolAddressProvider)
    LimitOrderProtocolBase(limitOrderProtocol) AaveBase(_lendingPoolAddressProvider) {}

    function isHFBelowThreshold(address _user, uint256 _threshold) external view returns(bool) {
        uint256 _healthFactor;
        (, , , , , _healthFactor) = LENDING_POOL.getUserAccountData(_user);
        return _healthFactor < _threshold;
    }

    function getHealthFactor(address _user) external view returns(uint256) {
        uint256 _healthFactor;
        (, , , , , _healthFactor) = LENDING_POOL.getUserAccountData(_user);
        return _healthFactor;
    }

    function setFee(uint256 _newFee) public onlyOwner{
        fee = _newFee;
    }


    function _liquidate(
        address _collateral,
        address _reserve,
        address _user,
        uint256 _purchaseAmount,
        bool _receiveaToken
    )
    internal
    {
        require(IERC20(_reserve).approve(address(LENDING_POOL), _purchaseAmount), "Approval error");
        LENDING_POOL.liquidationCall(_collateral, _reserve, _user, _purchaseAmount, _receiveaToken);
    }

    function notifyFillOrder(
        address makerAsset,
        address takerAsset,
        uint256 makingAmount,
        uint256 takingAmount,
        bytes memory interactiveData // abi.encode(orderHash)
    ) external override {
        require(msg.sender == LIMIT_ORDER_PROTOCOL, "only LOP can exec callback");
        makerAsset;
        takingAmount;
        address collateral;
        address reserve;
        address user;
        uint256 purchaseAmount;
        bool receiveaToken;

        (collateral, reserve, user, purchaseAmount, receiveaToken) = abi.decode(interactiveData, (address, address, address, uint256, bool));
        _liquidate(collateral, reserve, user, purchaseAmount, receiveaToken);
        // TODO: remove from a list of user's orders
        // deleteOrder(user)

        // approve makingAmount to send to maker
        IERC20(makerAsset).approve(msg.sender, makingAmount);

        // Check if liquidation profit is higher than makingAmount + gas cost

        // Calculate the the remainder and send it to a user
        // TODO: include fee
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external override view returns(bytes4) {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory getMakerAmount;
        bytes memory getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {  // solhint-disable-line no-inline-assembly
            salt := mload(add(signature, 0x40))
            makerAsset := mload(add(signature, 0x60))
            takerAsset := mload(add(signature, 0x80))
            makerAssetData := add(add(signature, 0x40), mload(add(signature, 0xA0)))
            takerAssetData := add(add(signature, 0x40), mload(add(signature, 0xC0)))
            getMakerAmount := add(add(signature, 0x40), mload(add(signature, 0xE0)))
            getTakerAmount := add(add(signature, 0x40), mload(add(signature, 0x100)))
            predicate := add(add(signature, 0x40), mload(add(signature, 0x120)))
            permit := add(add(signature, 0x40), mload(add(signature, 0x140)))
            interaction := add(add(signature, 0x40), mload(add(signature, 0x160)))
        }

        require(
            _hash(salt, makerAsset, takerAsset, makerAssetData, takerAssetData, getMakerAmount, getTakerAmount, predicate, permit, interaction) == hash,
            "bad order"
        );

        return this.isValidSignature.selector;
    }

}
