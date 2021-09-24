// SPDX-License-Identifier: ISC
pragma solidity ^0.8.4;

contract Timecapsule {
    struct Capsule {
        address from;
        uint256 value;
        uint256 unlocksAt;
        bool claimed;
    }

    address public owner;

    // Mapping of { recipientAddress => { capsuleId => Capsule } }
    // Note: this means a given sender can only send one capsule to a recipient
    mapping(address => mapping(uint256 => Capsule)) private _capsulesMap;

    // Mapping of recipientAddress => total pending capsule balance
    mapping(address => uint256) public _pendingBalanceOf;

    // Mapping of recipientAddress => pending (unclaimed Capsules)
    // mapping(address => Capsule[]) private pendingCapsules;

    // Mapping of recipientAddress to the next capsuleID to use:
    mapping(address => uint256) private _nextCapsuleIdOf;

    event CapsuleSent(address indexed from, address indexed to, uint256 unlocksAt, uint256 value);
    event CapsuleClaimed(address indexed from, address indexed to, uint256 value);
    event TransferOwnership(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(owner == msg.sender, "Must be owner to call");
        _;
    }

    /**
     * Contract initialization.
     *
     * The `constructor` is executed only once when the contract is created.
     */
    constructor() {
        owner = msg.sender;
    }

    function send(address to, uint256 unlocksAt) external payable {
        address from = msg.sender;
        uint256 value = msg.value;
        require(value > 0, "Amount must be >0");

        uint256 capsuleId = _nextCapsuleIdOf[to];

        // Increment capsule ID counter:
        _nextCapsuleIdOf[to] += 1;

        _pendingBalanceOf[to] += value;
        _capsulesMap[to][capsuleId] = Capsule(from, value, unlocksAt, false);

        emit CapsuleSent(from, to, value, unlocksAt);
    }

    function claim(uint256 capsuleId) external payable {
        address to = msg.sender;

        Capsule memory capsule = _capsulesMap[to][capsuleId];
        uint256 value = capsule.value;
        require(value > 0, "Amount must be >0");
        require(capsule.unlocksAt <= block.timestamp, "Not unlocked yet");
        require(!capsule.claimed, "Already claimed");

        // Security: perform these before initiating transfer below to avoid
        // state re-entrancy:
        // https://quantstamp.com/blog/what-is-a-re-entrancy-attack
        _capsulesMap[to][capsuleId].claimed = true;
        _pendingBalanceOf[to] -= value;

        payable(msg.sender).transfer(value);

        emit CapsuleClaimed(capsule.from, to, value);
    }

    function getCapsule(address account, uint256 capsuleId) external view returns (Capsule memory) {
        return _capsulesMap[account][capsuleId];
    }

    function getPendingBalance(address account) external view returns (uint256) {
        return _pendingBalanceOf[account];
    }

    function getCapsulesCount(address account) external view returns (uint256) {
        return _nextCapsuleIdOf[account];
    }

    /**
     * Allows the current owner to transfer control of the contract to a newOwner.
     * newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        // Note: allow "burning" ownership by transferring to zero:
        // require(newOwner != address(0), "New owner cannot be zero address");

        address oldOwner = owner;
        owner = newOwner;

        emit TransferOwnership(oldOwner, newOwner);
    }
}
