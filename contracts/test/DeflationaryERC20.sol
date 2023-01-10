// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract DeflationaryERC20 is ERC20 {
    uint256 public taxRate;

    address public immutable taxReceiver;

    uint8 private overriddenDecimals;

    constructor(address _taxReceiver) ERC20("DEFL20", "DEFL") {
        overriddenDecimals = 18;
        taxReceiver = _taxReceiver;
    }

    function setTaxRate(uint256 _taxRate) public {
        taxRate = _taxRate;
    }

    function mint(uint256 amt) external {
        _mint(msg.sender, amt);
    }

    function transfer(address to, uint256 amount)
        public
        virtual
        override
        returns (bool)
    {
        address owner = _msgSender();
        uint256 tax = getTax(amount);
        uint256 amountToTransfer = amount - tax;

        // Transfer 10% of the funds to the tax receiver
        _transfer(owner, taxReceiver, tax);
        // // Transfer 90% of the funds to the recipient
        _transfer(owner, to, amountToTransfer);

        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 tax = getTax(amount);
        uint256 amountToTransfer = amount - tax;

        // Transfer 10% of the funds to the tax receiver
        _transfer(from, taxReceiver, tax);
        // Transfer 90% of the funds to the recipient
        _transfer(from, to, amountToTransfer);

        return true;
    }

    function overrideDecimals(uint8 _overriddenDecimals) external {
        overriddenDecimals = _overriddenDecimals;
    }

    function decimals() public view override returns (uint8) {
        return overriddenDecimals;
    }

    function getTax(uint256 amt) public view returns (uint256) {
        if (taxRate != 0) {
            return amt / taxRate;
        }
        return 0;
    }
}
