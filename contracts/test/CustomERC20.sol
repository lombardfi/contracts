// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CustomERC20 is ERC20 {
    uint8 private overriddenDecimals;

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol) {
        overriddenDecimals = _decimals;
    }

    function mint(uint256 amt) external {
        _mint(msg.sender, amt);
    }

    function overrideDecimals(uint8 _overriddenDecimals) external {
        overriddenDecimals = _overriddenDecimals;
    }

    function decimals() public view override returns (uint8) {
        return overriddenDecimals;
    }
}
