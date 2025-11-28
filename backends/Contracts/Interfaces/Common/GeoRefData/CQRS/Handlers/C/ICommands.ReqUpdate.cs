// -----------------------------------------------------------------------
// <copyright file="ICommands.ReqUpdate.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.C;

using D2.Contracts.Handler;

public partial interface ICommands
{
    /// <summary>
    /// Handler for requesting an update of geographic reference data.
    /// </summary>
    /// <remarks>
    /// To be used by data consumers only.
    /// </remarks>
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
