export class ApiError extends Error {
  readonly status:number;
  readonly code:string;
  constructor(status:number,code:string,message:string) { super(message); this.name='ApiError';this.status=status;this.code=code; }
}
export class StreamInterruptedError extends Error {
  constructor() { super('The response stream was interrupted. Reload turn/history before retrying the same submission.');this.name='StreamInterruptedError'; }
}
