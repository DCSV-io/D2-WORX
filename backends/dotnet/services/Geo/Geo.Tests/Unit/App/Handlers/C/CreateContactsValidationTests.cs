// -----------------------------------------------------------------------
// <copyright file="CreateContactsValidationTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Geo.Tests.Unit.App.Handlers.C;

using D2.Geo.App.Implementations.CQRS.Handlers.C;
using D2.Geo.App.Interfaces.CQRS.Handlers.Q;
using D2.Services.Protos.Geo.V1;
using D2.Shared.Handler;
using D2.Shared.Result;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using CqrsCmd = D2.Geo.App.Interfaces.CQRS.Handlers.C.ICommands;
using CreateRepo = D2.Geo.App.Interfaces.Repository.Handlers.C.ICreate;

/// <summary>
/// Unit tests for the <see cref="CreateContacts"/> CQRS handler's validation logic.
/// </summary>
/// <remarks>
/// Tests both FluentValidation (Phase 1) and the empty-input early-exit path.
/// All repository and query dependencies are mocked; no database is required.
/// </remarks>
public class CreateContactsValidationTests
{
    private readonly Mock<CreateRepo.ICreateContactsHandler> r_mockCreateContactsRepo;
    private readonly Mock<CreateRepo.ICreateLocationsHandler> r_mockCreateLocationsRepo;
    private readonly Mock<IQueries.IGetLocationsByIdsHandler> r_mockGetLocationsByIds;
    private readonly IHandlerContext r_context;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateContactsValidationTests"/> class.
    /// </summary>
    public CreateContactsValidationTests()
    {
        r_mockCreateContactsRepo = new Mock<CreateRepo.ICreateContactsHandler>();
        r_mockCreateContactsRepo
            .Setup(x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<CreateRepo.CreateContactsOutput?>.Ok(
                new CreateRepo.CreateContactsOutput()));

        r_mockCreateLocationsRepo = new Mock<CreateRepo.ICreateLocationsHandler>();
        r_mockCreateLocationsRepo
            .Setup(x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateLocationsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<CreateRepo.CreateLocationsOutput?>.Ok(
                new CreateRepo.CreateLocationsOutput(0)));

        r_mockGetLocationsByIds = new Mock<IQueries.IGetLocationsByIdsHandler>();
        r_mockGetLocationsByIds
            .Setup(x => x.HandleAsync(
                It.IsAny<IQueries.GetLocationsByIdsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()))
            .ReturnsAsync(D2Result<IQueries.GetLocationsByIdsOutput?>.Ok(
                new IQueries.GetLocationsByIdsOutput(new())));

        r_context = CreateHandlerContext();
    }

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    #region Empty Input

    /// <summary>
    /// Tests that an empty contacts list returns success with an empty output.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyInput_ReturnsSuccessWithEmptyList()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest();
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data!.Data.Should().BeEmpty();
    }

    #endregion

    #region Valid Input

    /// <summary>
    /// Tests that valid contacts pass validation and delegate to the repository.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task ValidContacts_PassesValidationAndDelegatesToRepo()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "auth-user",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = "John" },
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert — should not be ValidationFailed
        result.ErrorCode.Should().NotBe(ErrorCodes.VALIDATION_FAILED);

        // Repo should have been called
        r_mockCreateContactsRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Once);
    }

    #endregion

    #region Single-Field Validation Failures

    /// <summary>
    /// Tests that an empty context key returns ValidationFailed.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyContextKey_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0].Contains("contextKey"));
    }

    /// <summary>
    /// Tests that an invalid related entity ID returns ValidationFailed.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidRelatedEntityId_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "auth-user",
                    RelatedEntityId = "not-a-guid",
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0].Contains("relatedEntityId"));
    }

    /// <summary>
    /// Tests that an empty first name (when personal details provided) returns ValidationFailed.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task EmptyFirstName_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "auth-user",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    PersonalDetails = new PersonalDTO { FirstName = string.Empty },
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0].Contains("firstName"));
    }

    /// <summary>
    /// Tests that an invalid email format returns ValidationFailed.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task InvalidEmail_ReturnsValidationFailed()
    {
        // Arrange
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = "auth-user",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                    ContactMethods = new ContactMethodsDTO
                    {
                        Emails = { new EmailAddressDTO { Value = "not-an-email" } },
                    },
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
    }

    #endregion

    #region Multi-Item Validation

    /// <summary>
    /// Tests that multiple invalid items produce indexed error paths.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task MultipleInvalidItems_ReturnsIndexedErrorPaths()
    {
        // Arrange — items[0] and [2] are invalid, items[1] is valid.
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
                new ContactToCreateDTO
                {
                    ContextKey = "valid-key",
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
                new ContactToCreateDTO
                {
                    ContextKey = "valid-key",
                    RelatedEntityId = "not-a-guid",
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[0]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[2]."));
        result.InputErrors.Should().NotContain(e => e[0].StartsWith("items[1]."));
    }

    /// <summary>
    /// Tests that all invalid items produce errors for every index.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task AllItemsInvalid_ReturnsAllErrors()
    {
        // Arrange — all 3 items have empty context keys.
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = Guid.NewGuid().ToString(),
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        var result = await handler.HandleAsync(input, Ct);

        // Assert
        result.Failed.Should().BeTrue();
        result.ErrorCode.Should().Be(ErrorCodes.VALIDATION_FAILED);
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[0]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[1]."));
        result.InputErrors.Should().Contain(e => e[0].StartsWith("items[2]."));
    }

    #endregion

    #region Repo Not Called on Failure

    /// <summary>
    /// Tests that repository handlers are not called when validation fails.
    /// </summary>
    /// <returns>A task representing the asynchronous test.</returns>
    [Fact]
    public async Task RepoNotCalledWhenValidationFails()
    {
        // Arrange — invalid input
        var handler = CreateHandler();
        var request = new CreateContactsRequest
        {
            ContactsToCreate =
            {
                new ContactToCreateDTO
                {
                    ContextKey = string.Empty,
                    RelatedEntityId = string.Empty,
                },
            },
        };
        var input = new CqrsCmd.CreateContactsInput(request);

        // Act
        await handler.HandleAsync(input, Ct);

        // Assert — none of the repos should be called
        r_mockCreateContactsRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateContactsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);

        r_mockCreateLocationsRepo.Verify(
            x => x.HandleAsync(
                It.IsAny<CreateRepo.CreateLocationsInput>(),
                It.IsAny<CancellationToken>(),
                It.IsAny<HandlerOptions?>()),
            Times.Never);
    }

    #endregion

    #region Helpers

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

    private CqrsCmd.ICreateContactsHandler CreateHandler()
    {
        return new CreateContacts(
            r_mockCreateContactsRepo.Object,
            r_mockCreateLocationsRepo.Object,
            r_mockGetLocationsByIds.Object,
            r_context);
    }

    #endregion
}
