// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "../interfaces/IBasePriceOracle.sol";

/**
 * @title TestOracle
 * @notice Contract used only for test purposes.
 */
contract TestOracle is IBasePriceOracle {
    mapping(address => bool) public forceFail;
    mapping(address => bool) public supportedAssets;
    mapping(address => uint256) public assetPrices;
    mapping(address => bool) public disabledAssets;

    constructor(address[] memory _assets, uint256[] memory _prices) {
        for (uint256 i = 0; i < _assets.length; i++) {
            supportedAssets[_assets[i]] = true;
            assetPrices[_assets[i]] = _prices[i];
        }
    }

    function setAssetStatus(address baseAsset, bool baseAssetState) external {
        disabledAssets[baseAsset] = baseAssetState;
    }

    function setSupportedAssetsAndPrices(
        address[] memory _assets,
        uint256[] memory _prices
    ) external {
        for (uint256 i = 0; i < _assets.length; i++) {
            supportedAssets[_assets[i]] = true;
            assetPrices[_assets[i]] = _prices[i];
        }
    }

    function setForceFail(address _asset) external {
        forceFail[_asset] = true;
    }

    function supportsAsset(address _asset, address _baseAsset)
        external
        view
        returns (bool)
    {
        return supportedAssets[_asset];
    }

    function getPrice(address _asset, address _baseAsset)
        external
        view
        returns (bool, uint256)
    {
        if (
            forceFail[_asset] ||
            !supportedAssets[_asset] ||
            disabledAssets[_asset]
        ) {
            return (false, 0);
        }

        return (true, assetPrices[_asset]);
    }
}
