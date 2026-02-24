// -----------------------------------------------------------------------
// <copyright file="IComplex.UpdateContactsByExtKeys.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.App.Interfaces.CQRS.Handlers.X;

using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;

public partial interface IComplex
{
    /// <summary>
    /// Handler for replacing Contacts at given external keys.
    /// Reads existing contacts, deletes them, creates new ones, and returns replacement mappings.
    /// </summary>
    public interface IUpdateContactsByExtKeysHandler
        : IHandler<UpdateContactsByExtKeysInput, UpdateContactsByExtKeysOutput>;

    /// <summary>
    /// Input for updating Contacts by their external keys.
    /// </summary>
    ///
    /// <param name="Request">
    /// The proto request containing the contacts to create (with ext-key context).
    /// </param>
    public record UpdateContactsByExtKeysInput(UpdateContactsByExtKeysRequest Request);

    /// <summary>
    /// Represents a single old-to-new contact replacement entry.
    /// </summary>
    ///
    /// <param name="ContextKey">
    /// The ext-key context key.
    /// </param>
    /// <param name="RelatedEntityId">
    /// The ext-key related entity ID.
    /// </param>
    /// <param name="OldContactId">
    /// The ID of the old contact that was deleted.
    /// </param>
    /// <param name="NewContact">
    /// The newly created contact DTO that replaced the old one.
    /// </param>
    public record ContactReplacementItem(
        string ContextKey,
        Guid RelatedEntityId,
        Guid OldContactId,
        ContactDTO NewContact);

    /// <summary>
    /// Output for updating Contacts by their external keys.
    /// </summary>
    ///
    /// <param name="Replacements">
    /// The list of replacement mappings (old contact → new contact).
    /// Each entry contains the full new <see cref="ContactDTO"/>.
    /// </param>
    public record UpdateContactsByExtKeysOutput(
        List<ContactReplacementItem> Replacements);
}
