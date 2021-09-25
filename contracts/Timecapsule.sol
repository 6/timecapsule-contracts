// SPDX-License-Identifier: ISC
pragma solidity ^0.8.4;

contract Timecapsule {
    struct Capsule {
        address from;
        uint256 value;
        uint256 createdAt;
        uint256 unlocksAt;
        bool opened;
    }

    address public owner;

    // Mapping of { recipientAddress => { capsuleId => Capsule } }
    mapping(address => mapping(uint256 => Capsule)) private _capsulesMap;

    // Mapping of recipientAddress => total pending capsule balance
    mapping(address => uint256) public _pendingBalanceOf;

    // Mapping of recipientAddress to the next capsuleID to use:
    mapping(address => uint256) private _nextCapsuleIdOf;

    event CapsuleSent(uint256 indexed capsuleId, address indexed from, address indexed to, uint256 unlocksAt, uint256 value);
    event CapsuleOpened(uint256 indexed capsuleId, address indexed to, uint256 value);
    event UndidCapsuleSend(uint256 indexed capsuleId, address indexed from, address indexed to, uint256 unlocksAt, uint256 value);
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

    // Send a capsule to someone (or yourself) to unlock at a future date:
    function send(address to, uint256 unlocksAt) external payable {
        address from = msg.sender;
        uint256 value = msg.value;
        require(value > 0, "Amount must be >0");

        // TODO: figure out how to make tests work with below condition:
        // require(unlocksAt > block.timestamp, "Must unlock in the future");
        //
        // https://hardhat.org/plugins/hardhat-time-n-mine.html
        // https://ethereum.stackexchange.com/questions/86633/time-dependent-tests-with-hardhat

        uint256 capsuleId = _nextCapsuleIdOf[to];

        // Increment capsule ID counter:
        _nextCapsuleIdOf[to] += 1;

        _pendingBalanceOf[to] += value;
        _capsulesMap[to][capsuleId] = Capsule(from, value, block.timestamp, unlocksAt, false);

        emit CapsuleSent(capsuleId, from, to, value, unlocksAt);
    }

    // Allows sender to undo capsule send for up to 24 hours:
    function undoSend(address to, uint256 capsuleId) external payable {
        Capsule memory capsule = _capsulesMap[to][capsuleId];
        require(capsule.from == msg.sender, "You did not send this capsule");
        require(!capsule.opened, "Capsule already opened");

        uint256 mostRecentCapsuleId = _nextCapsuleIdOf[to] - 1;
        require(capsuleId == mostRecentCapsuleId, "Can only undo most recent");

        uint256 undoExpiresAt = capsule.createdAt + 86400;
        require(undoExpiresAt >= block.timestamp, "Undo capability expired");

        _pendingBalanceOf[to] -= capsule.value;
        _nextCapsuleIdOf[to] -= 1;
        delete _capsulesMap[to][capsuleId];

        payable(capsule.from).transfer(capsule.value);

        emit UndidCapsuleSend(capsuleId, capsule.from, to, capsule.unlocksAt, capsule.value);
    }

    // Opens a capsule and claims the value inside:
    function open(uint256 capsuleId) external payable {
        address to = msg.sender;

        Capsule memory capsule = _capsulesMap[to][capsuleId];
        require(capsule.unlocksAt <= block.timestamp, "Not unlocked yet");
        require(!capsule.opened, "Already opened");

        // Security: perform these before initiating transfer below to avoid
        // state re-entrancy:
        // https://quantstamp.com/blog/what-is-a-re-entrancy-attack
        _capsulesMap[to][capsuleId].opened = true;
        _pendingBalanceOf[to] -= capsule.value;

        payable(to).transfer(capsule.value);

        emit CapsuleOpened(capsuleId, to, capsule.value);
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
