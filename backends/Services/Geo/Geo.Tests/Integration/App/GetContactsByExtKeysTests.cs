// -----------------------------------------------------------------------
// <copyright file="GetContactsByExtKeysTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Integration.App;

using D2.Contracts.Handler;
using D2.Contracts.Result;
using D2.Geo.App.Implementations.CQRS.Handlers.Q;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Geo.Domain.Entities;
using D2.Geo.Domain.ValueObjects;
using D2.Geo.Infra;
using D2.Geo.Infra.Repository;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;
using GetContactsByExtKeysRepo = D2.Geo.Infra.Repository.Handlers.R.GetContactsByExtKeys;

/// <summary>
/// Integration tests for the <see cref="GetContactsByExtKeys"/> CQRS handler.
/// </summary>
[MustDisposeResource(false)]
public class GetContactsByExtKeysTests : IAsyncLifetime
{
    private PostgreSqlContainer _pgContainer = null!;
    private GeoDbContext _db = null!;
    private IHandlerContext _context = null!;
    private IOptions<GeoInfraOptions> _options = null!;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _pgContainer = new PostgreSqlBuilder()
            .WithImage("postgres:18")
            .Build();
        await _pgContainer.StartAsync(Ct);

        var dbOptions = new DbContextOptionsBuilder<GeoDbContext>()
            .UseNpgsql(_pgContainer.GetConnectionString())
            .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
            .Options;
        _db = new GeoDbContext(dbOptions);
        await _db.Database.MigrateAsync(Ct);

        _context = CreateHandlerContext();
        _options = Options.Create(new GeoInfraOptions { RepoQueryBatchSize = 100 });
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        await _db.DisposeAsync();
        await _pgContainer.DisposeAsync().ConfigureAwait(false);
    }

    #region Empty Input Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys with empty input returns success with empty dictionary.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithEmptyInput_ReturnsEmptyDictionary()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest();
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Get Single Contact Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys retrieves a single contact by external key.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithSingleKey_ReturnsContact()
    {
        // Arrange - Create a contact
        var relatedEntityId = Guid.NewGuid();
        var contact = CreateTestContact("test-context", relatedEntityId, "Single", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "test-context",
                    RelatedEntityId = relatedEntityId.ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var key = result.Data.Data.Keys.First();
        key.ContextKey.Should().Be("test-context");
        key.RelatedEntityId.Should().Be(relatedEntityId.ToString());

        var contacts = result.Data.Data[key];
        contacts.Should().HaveCount(1);
        contacts[0].PersonalDetails!.FirstName.Should().Be("Single");
    }

    #endregion

    #region Multiple Contacts Per Key Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys returns multiple contacts for a single external key.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithMultipleContactsSameKey_ReturnsAllContacts()
    {
        // Arrange - Create multiple contacts with the same external key
        var relatedEntityId = Guid.NewGuid();
        var contact1 = CreateTestContact("shared-context", relatedEntityId, "User", "One");
        var contact2 = CreateTestContact("shared-context", relatedEntityId, "User", "Two");
        var contact3 = CreateTestContact("shared-context", relatedEntityId, "User", "Three");
        _db.Contacts.AddRange(contact1, contact2, contact3);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "shared-context",
                    RelatedEntityId = relatedEntityId.ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var contacts = result.Data.Data.Values.First();
        contacts.Should().HaveCount(3);
    }

    #endregion

    #region Multiple Keys Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys handles multiple keys correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithMultipleKeys_ReturnsContactsGroupedByKey()
    {
        // Arrange - Create contacts with different external keys
        var relatedEntityId1 = Guid.NewGuid();
        var relatedEntityId2 = Guid.NewGuid();

        var contact1 = CreateTestContact("context-a", relatedEntityId1, "Contact", "A");
        var contact2 = CreateTestContact("context-b", relatedEntityId2, "Contact", "B");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "context-a",
                    RelatedEntityId = relatedEntityId1.ToString(),
                },
                new GetContactsExtKeys
                {
                    ContextKey = "context-b",
                    RelatedEntityId = relatedEntityId2.ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(2);

        var keys = result.Data.Data.Keys.ToList();
        keys.Should().Contain(k => k.ContextKey == "context-a");
        keys.Should().Contain(k => k.ContextKey == "context-b");
    }

    #endregion

    #region Not Found Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys returns NOT_FOUND when no contacts exist.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithNonExistentKey_ReturnsNotFound()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "non-existent",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.NOT_FOUND);
    }

    #endregion

    #region Partial Found Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys returns SOME_FOUND when only some keys match.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithMixedKeys_ReturnsSomeFound()
    {
        // Arrange - Create one contact
        var existingRelatedId = Guid.NewGuid();
        var contact = CreateTestContact("existing-context", existingRelatedId, "Existing", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "existing-context",
                    RelatedEntityId = existingRelatedId.ToString(),
                },
                new GetContactsExtKeys
                {
                    ContextKey = "non-existent",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.SOME_FOUND);
        result.Data!.Data.Should().HaveCount(1);

        var key = result.Data.Data.Keys.First();
        key.ContextKey.Should().Be("existing-context");
    }

    #endregion

    #region Invalid GUID Tests

    /// <summary>
    /// Tests that GetContactsByExtKeys filters out invalid GUID strings.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithInvalidGuids_FiltersInvalidKeys()
    {
        // Arrange - Create a contact
        var relatedEntityId = Guid.NewGuid();
        var contact = CreateTestContact("valid-ctx", relatedEntityId, "Valid", "Contact");
        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "valid-ctx",
                    RelatedEntityId = relatedEntityId.ToString(),
                },
                new GetContactsExtKeys
                {
                    ContextKey = "invalid-ctx",
                    RelatedEntityId = "not-a-guid",
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var key = result.Data.Data.Keys.First();
        key.ContextKey.Should().Be("valid-ctx");
    }

    /// <summary>
    /// Tests that GetContactsByExtKeys with only invalid GUIDs returns empty.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_WithOnlyInvalidGuids_ReturnsEmpty()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "ctx-1",
                    RelatedEntityId = "not-a-guid",
                },
                new GetContactsExtKeys
                {
                    ContextKey = "ctx-2",
                    RelatedEntityId = string.Empty,
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Same Context Different Entities Tests

    /// <summary>
    /// Tests that contacts with the same context but different related entities are handled correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task GetContactsByExtKeys_SameContextDifferentEntities_ReturnsCorrectContacts()
    {
        // Arrange - Create contacts with same context but different related entities
        var relatedEntityId1 = Guid.NewGuid();
        var relatedEntityId2 = Guid.NewGuid();

        var contact1 = CreateTestContact("same-context", relatedEntityId1, "Entity", "One");
        var contact2 = CreateTestContact("same-context", relatedEntityId2, "Entity", "Two");
        _db.Contacts.AddRange(contact1, contact2);
        await _db.SaveChangesAsync(Ct);

        var handler = CreateHandler();
        var request = new GetContactsByExtKeysRequest
        {
            Keys =
            {
                new GetContactsExtKeys
                {
                    ContextKey = "same-context",
                    RelatedEntityId = relatedEntityId1.ToString(),
                },
            },
        };
        var input = new IQueries.GetContactsByExtKeysInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().HaveCount(1);

        var contacts = result.Data.Data.Values.First();
        contacts.Should().HaveCount(1);
        contacts[0].PersonalDetails!.LastName.Should().Be("One");
    }

    #endregion

    private static IHandlerContext CreateHandlerContext()
    {
        var requestContext = new Mock<IRequestContext>();
        requestContext.Setup(x => x.TraceId).Returns(Guid.NewGuid().ToString());

        var logger = new Mock<ILogger>();

        var context = new Mock<IHandlerContext>();
        context.Setup(x => x.Request).Returns(requestContext.Object);
        context.Setup(x => x.Logger).Returns(logger.Object);

        return context.Object;
    }

    private static Contact CreateTestContact(
        string contextKey,
        Guid relatedEntityId,
        string firstName,
        string lastName)
    {
        return Contact.Create(
            contextKey: contextKey,
            relatedEntityId: relatedEntityId,
            personalDetails: Personal.Create(firstName, lastName: lastName));
    }

    private IQueries.IGetContactsByExtKeysHandler CreateHandler()
    {
        var getContactsRepo = new GetContactsByExtKeysRepo(_db, _options, _context);
        return new GetContactsByExtKeys(getContactsRepo, _context);
    }
}
