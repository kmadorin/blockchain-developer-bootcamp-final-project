// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./helpers/AaveBase.sol";
import "./helpers/LimitOrderProtocolBase.sol";
import "./interfaces/ILendingPoolAddressesProvider.sol";


contract Liquidator is LimitOrderProtocolBase, AaveBase, Ownable {
    using SafeERC20 for IERC20;
    using ArgumentsDecoder for bytes;
    using SafeMath for uint256;

    uint256 constant private _FROM_INDEX = 0;
    uint256 constant private _TO_INDEX = 1;
    uint256 constant private _AMOUNT_INDEX = 2;

    constructor(address limitOrderProtocol, ILendingPoolAddressesProvider _lendingPoolAddressProvider)
    LimitOrderProtocolBase(limitOrderProtocol) AaveBase(_lendingPoolAddressProvider) {}

    function getUserAccountData(address _user)
    external
    view
    returns (
        uint256 totalCollateralETH,
        uint256 totalDebtETH,
        uint256 availableBorrowsETH,
        uint256 currentLiquidationThreshold,
        uint256 ltv,
        uint256 healthFactor
    ) {
        (totalCollateralETH, totalDebtETH, availableBorrowsETH, currentLiquidationThreshold, ltv, healthFactor) = LENDING_POOL.getUserAccountData(_user);
    }

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
        IERC20(makerAsset).approve(msg.sender, makingAmount);
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
            makerAssetData.decodeAddress(_FROM_INDEX) == address(this) &&
            _hash(salt, makerAsset, takerAsset, makerAssetData, takerAssetData, getMakerAmount, getTakerAmount, predicate, permit, interaction) == hash,
            "bad order"
        );

        return this.isValidSignature.selector;
    }

}
