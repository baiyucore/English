function readPort(value: string | undefined, fallback: number): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65_535
    ? port
    : fallback;
}

export const Config = {
  ports: {
    server: 3000, // 服务端口
    ai: readPort(process.env.EN_AI_PORT, 3002), // 人工智能端口（避开本机 Langfuse 占用的 3001）
    web: 8080, // 前端端口
  },
};
