// -----------------------------------------------------------------------
// <copyright file="GeoService.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace Geo.API.Services;

using D2.Geo.App.Interfaces.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Result.Extensions;
using Geo.API.Interceptors;
using Grpc.Core;
using GeoComplex = D2.Geo.App.Interfaces.CQRS.Handlers.X.IComplex;
using GeoRefDataComplex = D2.Geo.Client.Interfaces.CQRS.Handlers.X.IComplex;
using SB = D2.Services.Protos.Geo.V1.GeoService.GeoServiceBase;

/// <summary>
/// Provides geographical reference data services.
/// </summary>
public class GeoService : SB
{
    private readonly GeoRefDataComplex.IGetHandler r_get;
    private readonly GeoComplex.IFindWhoIsHandler r_findWhoIs;
    private readonly IQueries.IGetContactsByIdsHandler r_getContacts;
    private readonly IQueries.IGetContactsByExtKeysHandler r_getContactsByExtKeys;
    private readonly ICommands.ICreateContactsHandler r_createContacts;
    private readonly ICommands.IDeleteContactsHandler r_deleteContacts;

    /// <summary>
    /// Initializes a new instance of the <see cref="GeoService"/> class.
    /// </summary>
    ///
    /// <param name="get">
    /// The handler for getting geographic reference data.
    /// </param>
    /// <param name="findWhoIs">
    /// The handler for finding WhoIs information.
    /// </param>
    /// <param name="getContacts">
    /// The handler for getting contacts by IDs.
    /// </param>
    /// <param name="getContactsByExtKeys">
    /// The handler for getting contacts by external keys.
    /// </param>
    /// <param name="createContacts">
    /// The handler for creating contacts.
    /// </param>
    /// <param name="deleteContacts">
    /// The handler for deleting contacts.
    /// </param>
    public GeoService(
        GeoRefDataComplex.IGetHandler get,
        GeoComplex.IFindWhoIsHandler findWhoIs,
        IQueries.IGetContactsByIdsHandler getContacts,
        IQueries.IGetContactsByExtKeysHandler getContactsByExtKeys,
        ICommands.ICreateContactsHandler createContacts,
        ICommands.IDeleteContactsHandler deleteContacts)
    {
        r_get = get;
        r_findWhoIs = findWhoIs;
        r_getContacts = getContacts;
        r_getContactsByExtKeys = getContactsByExtKeys;
        r_createContacts = createContacts;
        r_deleteContacts = deleteContacts;
    }

    /// <inheritdoc/>
    public override async Task<GetReferenceDataResponse> GetReferenceData(
        GetReferenceDataRequest request,
        ServerCallContext context)
    {
        var result = await r_get.HandleAsync(new(), context.CancellationToken);

        return new GetReferenceDataResponse
        {
            Result = result.ToProto(),
            Data = result.Data?.Data,
        };
    }

    /// <inheritdoc/>
    public override async Task<RequestReferenceDataUpdateResponse> RequestReferenceDataUpdate(
        RequestReferenceDataUpdateRequest request,
        ServerCallContext context)
    {
        var result = await r_get.HandleAsync(new(), context.CancellationToken);

        return new RequestReferenceDataUpdateResponse
        {
            Result = result.ToProto(),
            Data = result.Success
                ? new RequestReferenceDataUpdateData { Version = result.Data!.Data.Version }
                : null,
        };
    }

    /// <inheritdoc/>
    public override async Task<FindWhoIsResponse> FindWhoIs(
        FindWhoIsRequest request,
        ServerCallContext context)
    {
        var input = new GeoComplex.FindWhoIsInput(request);
        var result = await r_findWhoIs.HandleAsync(input, context.CancellationToken);

        var response = new FindWhoIsResponse { Result = result.ToProto() };

        if (result.Data is not null)
        {
            response.Data.AddRange(
                result.Data.Data.Select(kvp => new FindWhoIsData
                {
                    Key = kvp.Key,
                    Whois = kvp.Value,
                }));
        }

        return response;
    }

    /// <inheritdoc/>
    [RequiresApiKey]
    public override async Task<GetContactsResponse> GetContacts(
        GetContactsRequest request,
        ServerCallContext context)
    {
        var input = new IQueries.GetContactsByIdsInput(request);
        var result = await r_getContacts.HandleAsync(input, context.CancellationToken);

        var response = new GetContactsResponse { Result = result.ToProto() };

        if (result.Data is not null)
        {
            foreach (var kvp in result.Data.Data)
            {
                response.Data.Add(kvp.Key.ToString(), kvp.Value);
            }
        }

        return response;
    }

    /// <inheritdoc/>
    [RequiresApiKey(ValidateContextKeys = true)]
    public override async Task<GetContactsByExtKeysResponse> GetContactsByExtKeys(
        GetContactsByExtKeysRequest request,
        ServerCallContext context)
    {
        var input = new IQueries.GetContactsByExtKeysInput(request);
        var result = await r_getContactsByExtKeys.HandleAsync(input, context.CancellationToken);

        var response = new GetContactsByExtKeysResponse { Result = result.ToProto() };

        if (result.Data is not null)
        {
            response.Data.AddRange(
                result.Data.Data.Select(kvp =>
                {
                    var data = new GetContactsByExtKeysData { Key = kvp.Key };
                    data.Contacts.AddRange(kvp.Value);
                    return data;
                }));
        }

        return response;
    }

    /// <inheritdoc/>
    [RequiresApiKey(ValidateContextKeys = true)]
    public override async Task<CreateContactsResponse> CreateContacts(
        CreateContactsRequest request,
        ServerCallContext context)
    {
        var input = new ICommands.CreateContactsInput(request);
        var result = await r_createContacts.HandleAsync(input, context.CancellationToken);

        var response = new CreateContactsResponse { Result = result.ToProto() };

        if (result.Data is not null)
        {
            response.Data.AddRange(result.Data.Data);
        }

        return response;
    }

    /// <inheritdoc/>
    [RequiresApiKey]
    public override async Task<DeleteContactsResponse> DeleteContacts(
        DeleteContactsRequest request,
        ServerCallContext context)
    {
        var contactIds = request.Ids
            .Where(id => Guid.TryParse(id, out _))
            .Select(Guid.Parse)
            .ToList();

        var input = new ICommands.DeleteContactsInput(contactIds);
        var result = await r_deleteContacts.HandleAsync(input, context.CancellationToken);

        return new DeleteContactsResponse
        {
            Result = result.ToProto(),
            Deleted = result.Data?.Deleted ?? 0,
        };
    }

    /// <inheritdoc/>
    [RequiresApiKey(ValidateContextKeys = true)]
    public override Task<DeleteContactsByExtKeysResponse> DeleteContactsByExtKeys(
        DeleteContactsByExtKeysRequest request,
        ServerCallContext context)
    {
        // TODO: Implement when Geo.App ext-key delete handler is built.
        throw new RpcException(new Status(
            StatusCode.Unimplemented, "DeleteContactsByExtKeys not yet implemented."));
    }

    /// <inheritdoc/>
    [RequiresApiKey(ValidateContextKeys = true)]
    public override Task<UpdateContactsByExtKeysResponse> UpdateContactsByExtKeys(
        UpdateContactsByExtKeysRequest request,
        ServerCallContext context)
    {
        // TODO: Implement when Geo.App ext-key update handler is built.
        throw new RpcException(new Status(
            StatusCode.Unimplemented, "UpdateContactsByExtKeys not yet implemented."));
    }
}
