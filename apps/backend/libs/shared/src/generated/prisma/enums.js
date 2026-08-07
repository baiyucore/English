"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmRunStatus = exports.ChatAttachmentStatus = exports.ChatMessageRole = exports.ChatConversationStatus = exports.TradeStatus = void 0;
exports.TradeStatus = {
    NOT_PAY: 'NOT_PAY',
    WAIT_BUYER_PAY: 'WAIT_BUYER_PAY',
    TRADE_CLOSED: 'TRADE_CLOSED',
    TRADE_SUCCESS: 'TRADE_SUCCESS',
    TRADE_FINISHED: 'TRADE_FINISHED'
};
exports.ChatConversationStatus = {
    ACTIVE: 'ACTIVE',
    ARCHIVED: 'ARCHIVED'
};
exports.ChatMessageRole = {
    HUMAN: 'HUMAN',
    AI: 'AI',
    SYSTEM: 'SYSTEM',
    TOOL: 'TOOL'
};
exports.ChatAttachmentStatus = {
    UPLOADED: 'UPLOADED',
    READY: 'READY',
    ERROR: 'ERROR'
};
exports.LlmRunStatus = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED'
};
//# sourceMappingURL=enums.js.map