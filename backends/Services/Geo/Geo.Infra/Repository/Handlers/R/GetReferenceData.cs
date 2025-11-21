// -----------------------------------------------------------------------
// <copyright file="GetReferenceData.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.Infra.Repository.Handlers.R;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using H = Geo.App.Interfaces.Repository.R.IGeoReadRepo.IGetReferenceDataHandler;
using I = Geo.App.Interfaces.Repository.R.IGeoReadRepo.GetReferenceDataInput;
using O = Geo.App.Interfaces.Repository.R.IGeoReadRepo.GetReferenceDataOutput;

/// <summary>
/// Handler for getting all geographic reference data.
/// </summary>
public class GetReferenceData : BaseHandler<GetReferenceData, I, O>, H
{
    /// <summary>
    /// Initializes a new instance of the <see cref="GetReferenceData"/> class.
    /// </summary>
    ///
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetReferenceData(IHandlerContext context)
        : base(context)
    {
    }

    /// <summary>
    /// Executes the handler to get geographic reference data.
    /// </summary>
    ///
    /// <param name="input">
    /// The input parameters for the handler.
    /// </param>
    /// <param name="ct">
    /// The cancellation token.
    /// </param>
    ///
    /// <returns>
    /// A task that represents the asynchronous operation, containing the result of the handler
    /// execution.
    /// </returns>
    ///
    /// <exception cref="NotImplementedException">
    /// Always thrown as this method is not yet implemented.
    /// </exception>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        throw new NotImplementedException();
    }
}
