// -----------------------------------------------------------------------
// <copyright file="IGeoRefDataService.ReqUpdate.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.GeoRefDataService;

using D2.Contracts.Handler;
using D2.Services.Protos.Geo.V1;

public partial interface IGeoRefDataService
{
    /// <summary>
    /// Handler for requesting an update of geographic reference data.
    /// </summary>
    public interface IReqUpdateHandler : IHandler<ReqUpdateInput, ReqUpdateOutput>;

    /// <summary>
    /// Input for requesting an update of geographic reference data.
    /// </summary>
    public record ReqUpdateInput;

    /// <summary>
    /// Output for requesting an update of geographic reference data.
    /// </summary>
    public record ReqUpdateOutput;
}
