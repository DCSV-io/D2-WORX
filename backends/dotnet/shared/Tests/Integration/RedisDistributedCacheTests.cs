// -----------------------------------------------------------------------
// <copyright file="RedisDistributedCacheTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

// ReSharper disable RedundantCapturedContext
// ReSharper disable ClassNeverInstantiated.Local
// ReSharper disable UnusedMember.Local
namespace D2.Contracts.Tests.Integration;

// ReSharper disable AccessToStaticMemberViaDerivedType
using D2.Contracts.DistributedCache.Redis.Handlers.D;
using D2.Contracts.DistributedCache.Redis.Handlers.R;
using D2.Contracts.DistributedCache.Redis.Handlers.U;
using D2.Contracts.Handler;
using D2.Contracts.Interfaces.Caching.Distributed.Handlers.D;
using D2.Contracts.Interfaces.Caching.Distributed.Handlers.R;
using D2.Contracts.Interfaces.Caching.Distributed.Handlers.U;
using D2.Contracts.Result;
using D2.Services.Protos.Geo.V1;
using FluentAssertions;
using Google.Protobuf;
using Google.Protobuf.Reflection;
using JetBrains.Annotations;
using StackExchange.Redis;
using Testcontainers.Redis;

/// <summary>
/// Integration tests for the Redis distributed cache service.
/// </summary>
[MustDisposeResource(false)]
public class RedisDistributedCacheTests : IAsyncLifetime
{
    private RedisContainer _container = null!;
    private IConnectionMultiplexer _redis = null!;
    private IHandlerContext _context = null!;
    private bool _containerStopped;

    private CancellationToken Ct => TestContext.Current.CancellationToken;

    /// <inheritdoc/>
    public async ValueTask InitializeAsync()
    {
        _container = new RedisBuilder().Build();
        await _container.StartAsync(Ct);

        _redis = await ConnectionMultiplexer.ConnectAsync(
            _container.GetConnectionString());
        _context = TestHelpers.CreateHandlerContext();
    }

    /// <inheritdoc/>
    public async ValueTask DisposeAsync()
    {
        _redis.Dispose();
        await _container.DisposeAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Tests that getting a missing key returns NotFound.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyMissing_ReturnsNotFound()
    {
        var handler = new Get<string>(_redis, _context);
        var result = await handler.HandleAsync(
            new IRead.GetInput("missing-key"),
            Ct);

        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    /// <summary>
    /// Tests that getting an existing key returns the correct value.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenKeyExists_ReturnsValue()
    {
        var setHandler = new Set<string>(_redis, _context);
        await setHandler.HandleAsync(
            new IUpdate.SetInput<string>("test-key", "test-value"), Ct);

        var getHandler = new Get<string>(_redis, _context);
        var result = await getHandler.HandleAsync(
            new IRead.GetInput("test-key"), Ct);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().Be("test-value");
    }

    /// <summary>
    /// Tests that setting a value stores it in the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithValidInput_StoresValueInCache()
    {
        var setHandler = new Set<string>(_redis, _context);
        var setResult = await setHandler.HandleAsync(
            new IUpdate.SetInput<string>("key", "value"), Ct);

        setResult.Success.Should().BeTrue();

        var db = _redis.GetDatabase();
        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeTrue();
    }

    /// <summary>
    /// Tests that setting a value with expiration expires after the specified duration.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithExpiration_ExpiresAfterDuration()
    {
        var handler = new Set<string>(_redis, _context);
        await handler.HandleAsync(
            new IUpdate.SetInput<string>("key", "value", TimeSpan.FromMilliseconds(100)), Ct);

        await Task.Delay(200, Ct);

        var db = _redis.GetDatabase();
        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeFalse();
    }

    /// <summary>
    /// Tests that removing an existing key deletes it from the cache.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Remove_WithExistingKey_DeletesKeyFromCache()
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync("key", "value");

        var handler = new Remove(_redis, _context);
        await handler.HandleAsync(new IDelete.RemoveInput("key"), Ct);

        var cached = await db.StringGetAsync("key");
        cached.HasValue.Should().BeFalse();
    }

    /// <summary>
    /// Tests that checking existence of an existing key returns true.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Exists_WhenKeyExists_ReturnsTrue()
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync("key", "value");

        var handler = new Exists(_redis, _context);
        var result = await handler.HandleAsync(new IRead.ExistsInput("key"), Ct);

        result.Success.Should().BeTrue();
        result.Data!.Exists.Should().BeTrue();
    }

    /// <summary>
    /// Tests that checking existence of a missing key returns false.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Exists_WhenKeyMissing_ReturnsFalse()
    {
        var handler = new Exists(_redis, _context);
        var result = await handler.HandleAsync(new IRead.ExistsInput("missing-key"), Ct);

        result.Success.Should().BeTrue();
        result.Data!.Exists.Should().BeFalse();
    }

    /// <summary>
    /// Tests that setting and getting a complex object serializes and deserializes correctly.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithComplexObject_SerializesAndDeserializesCorrectly()
    {
        var testObject = new TestData { Id = 42, Name = "Test" };

        var setHandler = new Set<TestData>(_redis, _context);
        await setHandler.HandleAsync(
            new IUpdate.SetInput<TestData>("complex-key", testObject),
            Ct);

        var getHandler = new Get<TestData>(_redis, _context);
        var result = await getHandler.HandleAsync(new IRead.GetInput("complex-key"), Ct);

        result.Success.Should().BeTrue();
        result.Data!.Value.Should().BeEquivalentTo(testObject);
    }

    /// <summary>
    /// Tests that setting a protobuf message stores it correctly using binary serialization.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WithProtobufMessage_StoresAsBinaryData()
    {
        // Arrange
        var protoData = TestHelpers.TestGeoRefData;
        var handler = new Set<GeoRefData>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IUpdate.SetInput<GeoRefData>("proto-key", protoData),
            Ct);

        // Assert
        result.Success.Should().BeTrue();

        var db = _redis.GetDatabase();
        var cached = await db.StringGetAsync("proto-key");
        cached.HasValue.Should().BeTrue();

        // Verify it's binary protobuf, not JSON (protobuf won't start with '{')
        var bytes = (byte[])cached!;
        bytes.Should().NotBeEmpty();
        bytes[0].Should().NotBe((byte)'{');
    }

    /// <summary>
    /// Tests that getting a protobuf message deserializes correctly using ParseProtobuf internally.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WithProtobufMessage_DeserializesCorrectly()
    {
        // Arrange
        var protoData = TestHelpers.TestGeoRefData;

        var setHandler = new Set<GeoRefData>(_redis, _context);
        await setHandler.HandleAsync(
            new IUpdate.SetInput<GeoRefData>("proto-get-key", protoData),
            Ct);

        var getHandler = new Get<GeoRefData>(_redis, _context);

        // Act
        var result = await getHandler.HandleAsync(new IRead.GetInput("proto-get-key"), Ct);

        // Assert
        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNull();

        var retrieved = result.Data!.Value;
        retrieved!.Version.Should().Be(protoData.Version);
        retrieved.Countries.Should().ContainKey("US");
        retrieved.Countries["US"].DisplayName.Should().Be("United States");
        retrieved.Subdivisions.Should().ContainKey("US-AL");
        retrieved.Subdivisions["US-AL"].DisplayName.Should().Be("Alabama");
        retrieved.Currencies.Should().ContainKey("USD");
        retrieved.Currencies["USD"].Symbol.Should().Be("$");
        retrieved.Languages.Should().ContainKey("en");
        retrieved.Locales.Should().ContainKey("en-US");
        retrieved.GeopoliticalEntities.Should().ContainKey("NATO");
    }

    /// <summary>
    /// Tests that getting a value with corrupted JSON data returns deserialization error.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenDataIsCorruptedJson_ReturnsDeserializationError()
    {
        // Arrange - store malformed JSON directly in Redis
        var db = _redis.GetDatabase();
        await db.StringSetAsync("corrupted-key", "{invalid json that wont parse}}}");

        var handler = new Get<TestData>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IRead.GetInput("corrupted-key"),
            Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        result.ErrorCode.Should().Be(ErrorCodes.COULD_NOT_BE_DESERIALIZED);
    }

    /// <summary>
    /// Tests that getting a protobuf type without a Parser property returns failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WithFakeMessageWithoutParser_ReturnsFail()
    {
        // Arrange - store some binary data that looks like protobuf (non-printable first byte)
        var db = _redis.GetDatabase();
        await db.StringSetAsync("fake-proto-key", new byte[] { 0x0A, 0x01, 0x02, 0x03 });

        var handler = new Get<FakeMessageWithoutParser>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(new IRead.GetInput("fake-proto-key"), Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        result.ErrorCode.Should().Be(ErrorCodes.UNHANDLED_EXCEPTION);
    }

    /// <summary>
    /// Tests that getting a protobuf type with null Parser returns failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WithFakeMessageWithNullParser_ReturnsFail()
    {
        // Arrange - store some binary data that looks like protobuf (non-printable first byte)
        var db = _redis.GetDatabase();
        await db.StringSetAsync("null-parser-key", new byte[] { 0x0A, 0x01, 0x02, 0x03 });

        var handler = new Get<FakeMessageWithNullParser>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(new IRead.GetInput("null-parser-key"), Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        result.ErrorCode.Should().Be(ErrorCodes.UNHANDLED_EXCEPTION);
    }

    /// <summary>
    /// Tests that getting a protobuf type without ParseFrom method returns failure.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WithFakeMessageWithoutParseFrom_ReturnsFail()
    {
        // Arrange - store some binary data that looks like protobuf (non-printable first byte)
        var db = _redis.GetDatabase();
        await db.StringSetAsync("no-parsefrom-key", new byte[] { 0x0A, 0x01, 0x02, 0x03 });

        var handler = new Get<FakeMessageWithoutParseFrom>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(new IRead.GetInput("no-parsefrom-key"), Ct);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.InternalServerError);
        result.ErrorCode.Should().Be(ErrorCodes.UNHANDLED_EXCEPTION);
    }

    /// <summary>
    /// Tests that getting a value when Redis is unavailable returns ServiceUnavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Get_WhenRedisUnavailable_ReturnsServiceUnavailable()
    {
        // Arrange
        await EnsureContainerStoppedAsync();
        var handler = new Get<string>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IRead.GetInput("any-key"),
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        result.ErrorCode.Should().Be(ErrorCodes.SERVICE_UNAVAILABLE);
    }

    /// <summary>
    /// Tests that setting a value when Redis is unavailable returns ServiceUnavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Set_WhenRedisUnavailable_ReturnsServiceUnavailable()
    {
        // Arrange
        await EnsureContainerStoppedAsync();
        var handler = new Set<string>(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IUpdate.SetInput<string>("any-key", "any-value"),
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        result.ErrorCode.Should().Be(ErrorCodes.SERVICE_UNAVAILABLE);
    }

    /// <summary>
    /// Tests that checking existence when Redis is unavailable returns ServiceUnavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Exists_WhenRedisUnavailable_ReturnsServiceUnavailable()
    {
        // Arrange
        await EnsureContainerStoppedAsync();
        var handler = new Exists(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IRead.ExistsInput("any-key"),
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        result.ErrorCode.Should().Be(ErrorCodes.SERVICE_UNAVAILABLE);
    }

    /// <summary>
    /// Tests that removing a key when Redis is unavailable returns ServiceUnavailable.
    /// </summary>
    ///
    /// <returns>
    /// A <see cref="Task"/> representing the result of the asynchronous operation.
    /// </returns>
    [Fact]
    public async Task Remove_WhenRedisUnavailable_ReturnsServiceUnavailable()
    {
        // Arrange
        await EnsureContainerStoppedAsync();
        var handler = new Remove(_redis, _context);

        // Act
        var result = await handler.HandleAsync(
            new IDelete.RemoveInput("any-key"),
            CancellationToken.None);

        // Assert
        result.Success.Should().BeFalse();
        result.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        result.ErrorCode.Should().Be(ErrorCodes.SERVICE_UNAVAILABLE);
    }

    /// <summary>
    /// Ensures the Redis container is stopped for unavailability tests.
    /// Safe to call multiple times.
    /// </summary>
    private async Task EnsureContainerStoppedAsync()
    {
        if (_containerStopped)
        {
            return;
        }

        await _container.StopAsync(Ct);
        _containerStopped = true;
    }

    /// <summary>
    /// Fake IMessage implementation without a Parser property.
    /// </summary>
    private class FakeMessageWithoutParser : IMessage
    {
        /// <inheritdoc/>
        public MessageDescriptor Descriptor => null!;

        /// <inheritdoc/>
        public void MergeFrom(CodedInputStream input)
        {
        }

        /// <inheritdoc/>
        public void WriteTo(CodedOutputStream output)
        {
        }

        /// <inheritdoc/>
        public int CalculateSize() => 0;
    }

    /// <summary>
    /// Fake IMessage implementation with a null Parser property.
    /// </summary>
    private class FakeMessageWithNullParser : IMessage
    {
        /// <summary>
        /// Gets the parser (always null for testing).
        /// </summary>
        public static object? Parser => null;

        /// <inheritdoc/>
        public MessageDescriptor Descriptor => null!;

        /// <inheritdoc/>
        public void MergeFrom(CodedInputStream input)
        {
        }

        /// <inheritdoc/>
        public void WriteTo(CodedOutputStream output)
        {
        }

        /// <inheritdoc/>
        public int CalculateSize() => 0;
    }

    /// <summary>
    /// Fake IMessage implementation with a Parser that lacks ParseFrom method.
    /// </summary>
    private class FakeMessageWithoutParseFrom : IMessage
    {
        /// <summary>
        /// Gets the parser (missing ParseFrom method).
        /// </summary>
        public static FakeParser Parser => new();

        /// <inheritdoc/>
        public MessageDescriptor Descriptor => null!;

        /// <inheritdoc/>
        public void MergeFrom(CodedInputStream input)
        {
        }

        /// <inheritdoc/>
        public void WriteTo(CodedOutputStream output)
        {
        }

        /// <inheritdoc/>
        public int CalculateSize() => 0;

        /// <summary>
        /// Fake parser without ParseFrom method.
        /// </summary>
        public class FakeParser
        {
            // Intentionally missing ParseFrom(byte[]) method
        }
    }

    /// <summary>
    /// Test data class for complex object caching tests.
    /// </summary>
    private record TestData
    {
        /// <summary>
        /// Gets the identifier.
        /// </summary>
        [UsedImplicitly]
        public int Id { get; init; }

        /// <summary>
        /// Gets the name.
        /// </summary>
        [UsedImplicitly]
        public string Name { get; init; } = string.Empty;
    }
}
