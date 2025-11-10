using System.Text.Json;
using System.Text.Json.Serialization;

namespace D2.Contracts.Common;

public static class SerializerOptions
{
    public static readonly JsonSerializerOptions SR_IgnoreCycles = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles
    };
}
