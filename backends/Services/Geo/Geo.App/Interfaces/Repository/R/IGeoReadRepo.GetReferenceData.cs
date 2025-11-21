// -----------------------------------------------------------------------
// <copyright file="IGeoReadRepo.GetReferenceData.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.App.Interfaces.Repository.R;

using D2.Contracts.Handler;
using D2.Services.Protos.Geo.V1;

public partial interface IGeoReadRepo
{
    /// <summary>
    /// Handler for getting geographic reference data.
    /// </summary>
    public interface IGetReferenceDataHandler
        : IHandler<GetReferenceDataInput, GetReferenceDataOutput>;

    /// <summary>
    /// Input for getting geographic reference data.
    /// </summary>
    public record GetReferenceDataInput;

    /// <summary>
    /// Output for getting geographic reference data.
    /// </summary>
    ///
    /// <param name="Data">
    /// The geographic reference data retrieved.
    /// </param>
    public record GetReferenceDataOutput(GetReferenceDataResponse Data);
}
