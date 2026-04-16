import type { z } from "zod";

import { clientMessageSchemas } from "./protocol";
import type { ClientMessageType, ClientPayloadMap } from "./protocol";

export function parseClientMessage<TType extends ClientMessageType>(
  type: TType,
  payload: unknown
): z.SafeParseReturnType<ClientPayloadMap[TType], ClientPayloadMap[TType]> {
  const schema = clientMessageSchemas[type] as unknown as z.ZodType<
    ClientPayloadMap[TType]
  >;
  return schema.safeParse(payload);
}
