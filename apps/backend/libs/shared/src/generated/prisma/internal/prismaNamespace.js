"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineExtension = exports.JsonNullValueFilter = exports.NullsOrder = exports.QueryMode = exports.NullableJsonNullValueInput = exports.SortOrder = exports.LlmRunScalarFieldEnum = exports.ChatAttachmentScalarFieldEnum = exports.ChatMessageScalarFieldEnum = exports.ChatConversationScalarFieldEnum = exports.ChatAssistantScalarFieldEnum = exports.ChatPromptScalarFieldEnum = exports.CourseScalarFieldEnum = exports.CourseRecordScalarFieldEnum = exports.PaymentRecordScalarFieldEnum = exports.WordBookScalarFieldEnum = exports.WordBookRecordScalarFieldEnum = exports.UserScalarFieldEnum = exports.TransactionIsolationLevel = exports.ModelName = exports.AnyNull = exports.JsonNull = exports.DbNull = exports.NullTypes = exports.prismaVersion = exports.getExtensionContext = exports.Decimal = exports.Sql = exports.raw = exports.join = exports.empty = exports.sql = exports.PrismaClientValidationError = exports.PrismaClientInitializationError = exports.PrismaClientRustPanicError = exports.PrismaClientUnknownRequestError = exports.PrismaClientKnownRequestError = void 0;
const runtime = __importStar(require("@prisma/client/runtime/client"));
exports.PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
exports.PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
exports.PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
exports.PrismaClientInitializationError = runtime.PrismaClientInitializationError;
exports.PrismaClientValidationError = runtime.PrismaClientValidationError;
exports.sql = runtime.sqltag;
exports.empty = runtime.empty;
exports.join = runtime.join;
exports.raw = runtime.raw;
exports.Sql = runtime.Sql;
exports.Decimal = runtime.Decimal;
exports.getExtensionContext = runtime.Extensions.getExtensionContext;
exports.prismaVersion = {
    client: "7.3.0",
    engine: "9d6ad21cbbceab97458517b147a6a09ff43aa735"
};
exports.NullTypes = {
    DbNull: runtime.NullTypes.DbNull,
    JsonNull: runtime.NullTypes.JsonNull,
    AnyNull: runtime.NullTypes.AnyNull,
};
exports.DbNull = runtime.DbNull;
exports.JsonNull = runtime.JsonNull;
exports.AnyNull = runtime.AnyNull;
exports.ModelName = {
    User: 'User',
    WordBookRecord: 'WordBookRecord',
    WordBook: 'WordBook',
    PaymentRecord: 'PaymentRecord',
    CourseRecord: 'CourseRecord',
    Course: 'Course',
    ChatPrompt: 'ChatPrompt',
    ChatAssistant: 'ChatAssistant',
    ChatConversation: 'ChatConversation',
    ChatMessage: 'ChatMessage',
    ChatAttachment: 'ChatAttachment',
    LlmRun: 'LlmRun'
};
exports.TransactionIsolationLevel = runtime.makeStrictEnum({
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
});
exports.UserScalarFieldEnum = {
    id: 'id',
    name: 'name',
    email: 'email',
    phone: 'phone',
    address: 'address',
    password: 'password',
    avatar: 'avatar',
    bio: 'bio',
    isTimingTask: 'isTimingTask',
    timingTaskTime: 'timingTaskTime',
    wordNumber: 'wordNumber',
    dayNumber: 'dayNumber',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    lastLoginAt: 'lastLoginAt'
};
exports.WordBookRecordScalarFieldEnum = {
    id: 'id',
    wordId: 'wordId',
    isMaster: 'isMaster',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    userId: 'userId'
};
exports.WordBookScalarFieldEnum = {
    id: 'id',
    word: 'word',
    phonetic: 'phonetic',
    definition: 'definition',
    translation: 'translation',
    pos: 'pos',
    collins: 'collins',
    oxford: 'oxford',
    tag: 'tag',
    bnc: 'bnc',
    frq: 'frq',
    exchange: 'exchange',
    gk: 'gk',
    zk: 'zk',
    gre: 'gre',
    toefl: 'toefl',
    ielts: 'ielts',
    cet6: 'cet6',
    cet4: 'cet4',
    ky: 'ky',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.PaymentRecordScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    tradeNo: 'tradeNo',
    outTradeNo: 'outTradeNo',
    amount: 'amount',
    subject: 'subject',
    body: 'body',
    tradeStatus: 'tradeStatus',
    sendPayTime: 'sendPayTime',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.CourseRecordScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    courseId: 'courseId',
    isPurchased: 'isPurchased',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    paymentRecordId: 'paymentRecordId'
};
exports.CourseScalarFieldEnum = {
    id: 'id',
    name: 'name',
    value: 'value',
    description: 'description',
    teacher: 'teacher',
    url: 'url',
    price: 'price',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.ChatPromptScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    prompt: 'prompt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.ChatAssistantScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    name: 'name',
    prompt: 'prompt',
    isDefault: 'isDefault',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.ChatConversationScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    assistantId: 'assistantId',
    title: 'title',
    status: 'status',
    lastMessageAt: 'lastMessageAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.ChatMessageScalarFieldEnum = {
    id: 'id',
    conversationId: 'conversationId',
    role: 'role',
    content: 'content',
    metadata: 'metadata',
    createdAt: 'createdAt'
};
exports.ChatAttachmentScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    conversationId: 'conversationId',
    messageId: 'messageId',
    fileName: 'fileName',
    mimeType: 'mimeType',
    size: 'size',
    storageKey: 'storageKey',
    url: 'url',
    textContent: 'textContent',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.LlmRunScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    conversationId: 'conversationId',
    scene: 'scene',
    provider: 'provider',
    model: 'model',
    promptVersion: 'promptVersion',
    inputTokens: 'inputTokens',
    cachedInputTokens: 'cachedInputTokens',
    outputTokens: 'outputTokens',
    firstTokenMs: 'firstTokenMs',
    durationMs: 'durationMs',
    costCents: 'costCents',
    qualityScore: 'qualityScore',
    status: 'status',
    createdAt: 'createdAt'
};
exports.SortOrder = {
    asc: 'asc',
    desc: 'desc'
};
exports.NullableJsonNullValueInput = {
    DbNull: exports.DbNull,
    JsonNull: exports.JsonNull
};
exports.QueryMode = {
    default: 'default',
    insensitive: 'insensitive'
};
exports.NullsOrder = {
    first: 'first',
    last: 'last'
};
exports.JsonNullValueFilter = {
    DbNull: exports.DbNull,
    JsonNull: exports.JsonNull,
    AnyNull: exports.AnyNull
};
exports.defineExtension = runtime.Extensions.defineExtension;
//# sourceMappingURL=prismaNamespace.js.map