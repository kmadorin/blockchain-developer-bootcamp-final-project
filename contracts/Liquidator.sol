// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./helpers/AaveBase.sol";
import "./helpers/LimitOrderProtocolBase.sol";
import "./interfaces/ILendingPoolAddressesProvider.sol";
import "./interfaces/IPriceOracleGetter.sol";

import "hardhat/console.sol";


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

    constructor(address limitOrderProtocol, ILendingPoolAddressesProvider _lendingPoolAddressProvider, IPriceOracleGetter _aaveOracleAddress)
    LimitOrderProtocolBase(limitOrderProtocol) AaveBase(_lendingPoolAddressProvider, _aaveOracleAddress) {}

    function isHFBelowThreshold(address _user, uint256 _threshold) external view returns (bool) {
        uint256 _healthFactor;
        (,,,,, _healthFactor) = LENDING_POOL.getUserAccountData(_user);
        return _healthFactor < _threshold;
    }

    function getHealthFactor(address _user) external view returns (uint256) {
        uint256 _healthFactor;
        (,,,,, _healthFactor) = LENDING_POOL.getUserAccountData(_user);
        return _healthFactor;
    }

    function setFee(uint256 _newFee) public onlyOwner {
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
        //        uint256 startGas = gasleft();
        //        require(IERC20(_reserve).approve(address(LENDING_POOL), _purchaseAmount), "Approval error");
        //        uint256 gasUsed = startGas - gasleft();
        //        console.log('gasUsed', gasUsed);
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
        address user;

        (user) = abi.decode(interactiveData, (address));
        //        uint256 contractBalanceBefore = IERC20(makerAsset).balanceOf(address(this));
        //        console.log(contractBalanceBefore);
        //        uint256 startGas = gasleft();
        _liquidate(makerAsset, takerAsset, user, takingAmount, false);
        //        uint256 gasUsed = startGas - gasleft();
        //        console.log('gasUsed', gasUsed);

        //        console.log('successful liquidation');
        // TODO: remove from a list of user's orders
        // deleteOrder(user)

        //        uint256 contractBalanceAfter = IERC20(makerAsset).balanceOf(address(this));
        //        console.log(contractBalanceAfter);
        //        console.log('makingAmount', makingAmount);
        //        console.log('takingAmount', takingAmount);

        // approve makingAmount to send to taker
        //        IERC20(makerAsset).approve(msg.sender, makingAmount);

        // Check if liquidation profit is higher than makingAmount + gas cost

        // Calculate the the remainder and send it to a user
        // TODO: include fee
    }

    function approve(address _asset, address _spender, uint256 _value) onlyOwner external {
        IERC20(_asset).approve(_spender, _value);
    }

    function approveMax(address _asset, address _spender) onlyOwner external {
        IERC20(_asset).approve(_spender, type(uint256).max);
    }

    function transfer(address _asset, address _to, uint256 _value) onlyOwner external {
        IERC20(_asset).transfer(_to, _value);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external override view returns (bytes4) {
        uint256 salt;
        address makerAsset;
        address takerAsset;
        bytes memory makerAssetData;
        bytes memory takerAssetData;
        bytes memory _getMakerAmount;
        bytes memory _getTakerAmount;
        bytes memory predicate;
        bytes memory permit;
        bytes memory interaction;

        assembly {// solhint-disable-line no-inline-assembly
            salt := mload(add(signature, 0x40))
            makerAsset := mload(add(signature, 0x60))
            takerAsset := mload(add(signature, 0x80))
            makerAssetData := add(add(signature, 0x40), mload(add(signature, 0xA0)))
            takerAssetData := add(add(signature, 0x40), mload(add(signature, 0xC0)))
            _getMakerAmount := add(add(signature, 0x40), mload(add(signature, 0xE0)))
            _getTakerAmount := add(add(signature, 0x40), mload(add(signature, 0x100)))
            predicate := add(add(signature, 0x40), mload(add(signature, 0x120)))
            permit := add(add(signature, 0x40), mload(add(signature, 0x140)))
            interaction := add(add(signature, 0x40), mload(add(signature, 0x160)))
        }

        require(
            _hash(salt, makerAsset, takerAsset, makerAssetData, takerAssetData, _getMakerAmount, _getTakerAmount, predicate, permit, interaction) == hash,
            "bad order"
        );

        return this.isValidSignature.selector;
    }

    /// @notice Calculates maker amount based on taker amount and current makerAsset and takerAsset prices
    /// @return Result Floored maker amount
//    function getMakerAmount(uint256 orderTakerAmount, uint256 orderTakerAmountThreshold, address debtAsset, address collateralAsset, uint collateralBonus, uint debtReserveDecimals, uint collateralReserveDecimals, uint256 swapTakerAmount) external view returns (uint256) {
////        require(swapTakerAmount >= orderTakerAmountThreshold, 'Liquidator: taker amount should be above threshold');
////        if (swapTakerAmount < orderTakerAmountThreshold) {
////            return 0;
////        }
//        return swapTakerAmount * _calculateCollateralAmountAfterLiquidation(orderTakerAmount, debtAsset, collateralAsset, collateralBonus, debtReserveDecimals, collateralReserveDecimals) / orderTakerAmount;
//    }

    function getMakerAmount(uint256 orderMakerAmount, uint256 orderTakerAmount, uint256 swapTakerAmount) external view returns(uint256) {
        console.log('Computing getMakerAmount in Liquidator');
        console.log('swapTakerAmount', swapTakerAmount);
        console.log('orderMakerAmount', orderMakerAmount);
        console.log('orderTakerAmount', orderTakerAmount);
        return swapTakerAmount * orderMakerAmount / orderTakerAmount;
    }


//    function getTakerAmount(uint256 orderTakerAmount, uint256 orderTakerAmountThreshold, address debtAsset, address collateralAsset, uint collateralBonus, uint debtReserveDecimals, uint collateralReserveDecimals, uint256 swapMakerAmount) external view returns (uint256) {
//        console.log('getTakerAmount executed');
//        uint256 orderMakerAmount = _calculateCollateralAmountAfterLiquidation(orderTakerAmount, debtAsset, collateralAsset, collateralBonus, debtReserveDecimals, collateralReserveDecimals);
//        uint256 swapTakerAmount = (swapMakerAmount * orderTakerAmount + orderMakerAmount - 1) / orderMakerAmount;
//
//        require(swapTakerAmount >= orderTakerAmountThreshold, 'Liquidator: taker amount should be above threshold');
//
//        return swapTakerAmount;
//    }

    function _calculateCollateralAmountAfterLiquidation(uint256 debtAmount, address debtAsset, address collateralAsset, uint collateralBonus, uint debtReserveDecimals, uint collateralReserveDecimals) private view returns (uint256) {
        uint256 debtAssetPriceETH = AAVE_ORACLE.getAssetPrice(debtAsset);
        uint256 collateralAssetPriceETH = AAVE_ORACLE.getAssetPrice(collateralAsset);

        return _calculateRawCollateralAmount(debtAmount, debtAssetPriceETH, collateralAssetPriceETH, collateralReserveDecimals, debtReserveDecimals).mul(collateralBonus).div(10000);
    }

    function _calculateRawCollateralAmount(uint256 debtAmount, uint256 debtAssetPriceETH, uint256 collateralAssetPriceETH, uint collateralReserveDecimals, uint debtReserveDecimals) private pure returns (uint256) {
      return _updateCountingDecimals(debtAmount.mul(debtAssetPriceETH), collateralReserveDecimals, debtReserveDecimals).div(collateralAssetPriceETH);
    }

    function _updateCountingDecimals(uint256 value, uint collateralReserveDecimals, uint debtReserveDecimals) private pure returns (uint256) {
        if (collateralReserveDecimals == debtReserveDecimals) {
            return value;
        }
        if (collateralReserveDecimals > debtReserveDecimals) {
            return value.mul(10 ** (collateralReserveDecimals - debtReserveDecimals));
        } else {
            return value.div(10 ** (debtReserveDecimals - collateralReserveDecimals));
        }
    }

}
