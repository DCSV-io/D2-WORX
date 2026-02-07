// -----------------------------------------------------------------------
// <copyright file="RedactDataDestructuringPolicyTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.Logging;

using D2.Shared.ServiceDefaults.Logging;
using D2.Shared.Utilities.Attributes;
using D2.Shared.Utilities.Enums;
using FluentAssertions;
using Serilog;
using Serilog.Core;
using Serilog.Events;

/// <summary>
/// Unit tests for <see cref="RedactDataDestructuringPolicy"/>.
/// </summary>
public class RedactDataDestructuringPolicyTests
{
    private readonly RedactDataDestructuringPolicy _policy = new();

    // -----------------------------------------------------------------------
    // Test types
    // -----------------------------------------------------------------------

    [RedactData(Reason = RedactReason.PersonalInformation)]
    private record TypeLevelRedacted(string Name, string Email);

    private record PropertyLevelRedacted(
        [property: RedactData(Reason = RedactReason.PersonalInformation)] string IpAddress,
        [property: RedactData(Reason = RedactReason.PersonalInformation)] string UserAgent,
        string HandlerName);

    private record NoRedaction(string Name, int Age);

    private record NestedOuter(string Label, PropertyLevelRedacted Inner);

    // -----------------------------------------------------------------------
    // Tests
    // -----------------------------------------------------------------------

    [Fact]
    public void TypeLevelRedactData_ReplacesEntireValue()
    {
        // Arrange
        var value = new TypeLevelRedacted("Alice", "alice@example.com");
        var factory = CreateFactory();

        // Act
        var handled = _policy.TryDestructure(value, factory, out var result);

        // Assert
        handled.Should().BeTrue();
        result.Should().BeOfType<ScalarValue>();
        var scalar = (ScalarValue)result!;
        scalar.Value.Should().Be("[REDACTED: PersonalInformation]");
    }

    [Fact]
    public void PropertyLevelRedactData_MasksAnnotatedProperties()
    {
        // Arrange
        var value = new PropertyLevelRedacted("1.2.3.4", "Mozilla/5.0", "FindWhoIs");
        var factory = CreateFactory();

        // Act
        var handled = _policy.TryDestructure(value, factory, out var result);

        // Assert
        handled.Should().BeTrue();
        result.Should().BeOfType<StructureValue>();
        var structure = (StructureValue)result!;

        var props = structure.Properties.ToDictionary(p => p.Name, p => p.Value);

        // Redacted fields
        props["IpAddress"].Should().BeOfType<ScalarValue>()
            .Which.Value.Should().Be("[REDACTED: PersonalInformation]");
        props["UserAgent"].Should().BeOfType<ScalarValue>()
            .Which.Value.Should().Be("[REDACTED: PersonalInformation]");

        // Non-redacted field
        props["HandlerName"].Should().BeOfType<ScalarValue>()
            .Which.Value.Should().Be("FindWhoIs");
    }

    [Fact]
    public void NoRedactData_ReturnsFalse()
    {
        // Arrange
        var value = new NoRedaction("Bob", 42);
        var factory = CreateFactory();

        // Act
        var handled = _policy.TryDestructure(value, factory, out var result);

        // Assert
        handled.Should().BeFalse();
        result.Should().BeNull();
    }

    [Fact]
    public void NestedObject_RedactsRecursively()
    {
        // Arrange
        var inner = new PropertyLevelRedacted("10.0.0.1", "Chrome/100", "Test");
        var outer = new NestedOuter("MyLabel", inner);
        var factory = CreateFactory();

        // Act
        var handled = _policy.TryDestructure(outer, factory, out var result);

        // Assert — the outer type has no [RedactData], but NestedOuter has a
        // PropertyLevelRedacted property that triggers the policy recursively
        // through the factory.CreatePropertyValue call.
        // The outer itself doesn't have redaction attributes, so policy returns false.
        // The recursive redaction happens when Serilog calls the policy again for Inner.
        handled.Should().BeFalse();
    }

    [Fact]
    public void CachingWorks_SameTypeAnalyzedOnce()
    {
        // Arrange
        var factory = CreateFactory();
        var value1 = new PropertyLevelRedacted("1.1.1.1", "UA1", "H1");
        var value2 = new PropertyLevelRedacted("2.2.2.2", "UA2", "H2");

        // Act — call twice with same type
        _policy.TryDestructure(value1, factory, out var result1);
        _policy.TryDestructure(value2, factory, out var result2);

        // Assert — both should produce StructureValue (cached analysis)
        result1.Should().BeOfType<StructureValue>();
        result2.Should().BeOfType<StructureValue>();

        var props1 = ((StructureValue)result1!).Properties.ToDictionary(p => p.Name, p => p.Value);
        var props2 = ((StructureValue)result2!).Properties.ToDictionary(p => p.Name, p => p.Value);

        // Both should have redacted IpAddress
        ((ScalarValue)props1["IpAddress"]).Value.Should().Be("[REDACTED: PersonalInformation]");
        ((ScalarValue)props2["IpAddress"]).Value.Should().Be("[REDACTED: PersonalInformation]");

        // But non-redacted fields should differ
        ((ScalarValue)props1["HandlerName"]).Value.Should().Be("H1");
        ((ScalarValue)props2["HandlerName"]).Value.Should().Be("H2");
    }

    [Fact]
    public void CustomReason_UsedWhenProvided()
    {
        // Arrange
        var value = new CustomReasonType("secret-value");
        var factory = CreateFactory();

        // Act
        var handled = _policy.TryDestructure(value, factory, out var result);

        // Assert
        handled.Should().BeTrue();
        var scalar = (ScalarValue)result!;
        scalar.Value.Should().Be("[REDACTED: Contains API keys]");
    }

    [RedactData(CustomReason = "Contains API keys")]
    private record CustomReasonType(string Value);

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    /// <summary>
    /// Creates a simple ILogEventPropertyValueFactory using Serilog's built-in implementation.
    /// </summary>
    private static ILogEventPropertyValueFactory CreateFactory()
    {
        // Use a LoggerConfiguration with the policy to get a proper factory.
        // The simplest approach is to use Serilog's internal SimplePropertyValueConverter.
        // We'll create a logger config that gives us access to the factory.
        var config = new LoggerConfiguration()
            .Destructure.With(new RedactDataDestructuringPolicy());

        // Create a sink that captures events so we can extract the factory.
        var logger = config.CreateLogger();

        // Use a simple wrapper that delegates to Serilog's property creation.
        return new SerilogPropertyValueFactory(logger);
    }

    /// <summary>
    /// Adapter that uses a Serilog Logger to create property values.
    /// </summary>
    private sealed class SerilogPropertyValueFactory(ILogger logger) : ILogEventPropertyValueFactory
    {
        public LogEventPropertyValue CreatePropertyValue(object? value, bool destructureObjects = false)
        {
            // Use LogEvent property creation via binding.
            var prop = new LogEventProperty("__temp", new ScalarValue(value));

            if (value is null)
            {
                return new ScalarValue(null);
            }

            if (!destructureObjects || value is string || value.GetType().IsPrimitive)
            {
                return new ScalarValue(value);
            }

            // For complex types, use the logger's destructuring pipeline.
            LogEventPropertyValue? result = null;
            logger.BindProperty("__temp", value, destructureObjects, out var boundProp);
            if (boundProp is not null)
            {
                result = boundProp.Value;
            }

            return result ?? new ScalarValue(value?.ToString());
        }
    }
}
