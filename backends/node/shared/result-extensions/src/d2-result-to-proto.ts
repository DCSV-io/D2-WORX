import { type D2Result, type InputError } from "@d2/result";
import { D2ResultProtoFns, InputErrorProtoFns, type D2ResultProto } from "@d2/protos";

/**
 * Convert a D2Result to a D2ResultProto for gRPC transmission.
 * Mirrors D2.Shared.Result.Extensions.ProtoExtensions.ToProto() in .NET.
 */
export function d2ResultToProto(result: D2Result<unknown>): D2ResultProto {
  return D2ResultProtoFns.create({
    success: result.success,
    statusCode: result.statusCode,
    errorCode: result.errorCode ?? "",
    traceId: result.traceId ?? "",
    messages: [...result.messages],
    inputErrors: result.inputErrors.map((ie: InputError) =>
      InputErrorProtoFns.create({
        field: ie[0],
        errors: ie.slice(1),
      }),
    ),
  });
}
