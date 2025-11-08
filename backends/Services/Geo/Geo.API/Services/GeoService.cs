using D2.Services.Protos.Geo.V1;
using Grpc.Core;
using ServiceBase = D2.Services.Protos.Geo.V1.GeoService.GeoServiceBase;

namespace Geo.API.Services;

public class GeoService(ILogger<GeoService> logger) : ServiceBase
{
    public override Task<GeoResponse> GetGeo(
        GeoRequest request,
        ServerCallContext context)
    {
        logger.LogInformation($"Received GetGeo request: {request.Message}");

        // Dummy implementation for demonstration purposes
        var response = new GeoResponse
        {
            Message = "Hello world.",
            Timestamp = DateTimeOffset.Now.ToUnixTimeSeconds(),
        };

        return Task.FromResult(response);
    }
}
