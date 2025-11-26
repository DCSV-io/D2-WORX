// -----------------------------------------------------------------------
// <copyright file="GetFromDisk.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.GeoRefDataService.Default.CQRS.Handlers.Q;

using System.Net;
using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Contracts.Utilities.Constants;
using D2.Services.Protos.Geo.V1;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

// ReSharper disable AccessToStaticMemberViaDerivedType
using H = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.Q.IQueries.IGetFromDiskHandler;
using I = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.Q.IQueries.GetFromDiskInput;
using O = D2.Contracts.Interfaces.Common.GeoRefData.CQRS.Handlers.Q.IQueries.GetFromDiskOutput;

/// <summary>
/// Handler for getting georeference data from disk.
/// </summary>
public class GetFromDisk : BaseHandler<GetFromDisk, I, O>, H
{
    private readonly string r_filePath;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetFromDisk"/> class.
    /// </summary>
    ///
    /// <param name="config">
    /// The configuration instance.
    /// </param>
    /// <param name="context">
    /// The handler context.
    /// </param>
    public GetFromDisk(
        IConfiguration config,
        IHandlerContext context)
        : base(context)
    {
        var dataDir = config[Constants.LOCAL_FILES_PATH_CONFIG_KEY] ?? "./data";
        Directory.CreateDirectory(dataDir);
        r_filePath = Path.Combine(dataDir, Constants.GEO_REF_DATA_FILE_NAME);
    }

    /// <summary>
    /// Executes the handler to get georeference data from disk.
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
    /// The result of the get operation, containing the georeference data if found.
    /// </returns>
    protected override async ValueTask<D2Result<O?>> ExecuteAsync(
        I input,
        CancellationToken ct = default)
    {
        try
        {
            if (!File.Exists(r_filePath))
            {
                return D2Result<O?>.NotFound(traceId: TraceId);
            }

            var bytes = await File.ReadAllBytesAsync(r_filePath, ct);
            var data = GetReferenceDataResponse.Parser.ParseFrom(bytes);

            return D2Result<O?>.Ok(new O(data), traceId: TraceId);
        }
        catch (Google.Protobuf.InvalidProtocolBufferException ex)
        {
            Context.Logger.LogError(
                ex,
                "Failed to parse georeference data from disk. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Fail(
                ["Corrupted data on disk."],
                HttpStatusCode.InternalServerError,
                errorCode: ErrorCodes.COULD_NOT_BE_DESERIALIZED,
                traceId: TraceId);
        }
        catch (IOException ex)
        {
            Context.Logger.LogError(
                ex,
                "IOException occurred while reading georeference data from disk. TraceId: {TraceId}",
                TraceId);

            return D2Result<O?>.Fail(
                ["Unable to read from disk."],
                HttpStatusCode.InternalServerError,
                traceId: TraceId);
        }

        // Let the base handler catch any other exceptions.
    }
}
