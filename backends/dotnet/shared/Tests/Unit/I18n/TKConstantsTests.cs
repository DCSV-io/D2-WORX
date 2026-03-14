// -----------------------------------------------------------------------
// <copyright file="TKConstantsTests.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.Tests.Unit.I18n;

using System.Reflection;
using System.Text.Json;
using D2.Shared.I18n;
using FluentAssertions;

/// <summary>
/// Drift detection tests ensuring all <see cref="TK"/> constant values exist
/// as keys in the English message catalog (en-US.json).
/// </summary>
[Collection("I18n")]
public class TKConstantsTests
{
    private static readonly string sr_messagesDir = Path.Combine(AppContext.BaseDirectory, "messages");

    #region Drift Detection

    /// <summary>
    /// Uses reflection to find ALL <c>const string</c> fields recursively in the
    /// <see cref="TK"/> class hierarchy and verifies each value exists as a key in en-US.json.
    /// </summary>
    [Fact]
    public void AllTKConstants_ExistInEnglishCatalog()
    {
        // Arrange — load en-US.json keys
        var enJsonPath = Path.Combine(sr_messagesDir, "en-US.json");
        File.Exists(enJsonPath).Should().BeTrue("en-US.json must be copied to test output");

        var json = File.ReadAllText(enJsonPath);
        var entries = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
        entries.Should().NotBeNull();

        var enKeys = new HashSet<string>(entries!.Keys);

        // Act — collect all const string fields from TK and nested types
        var tkConstants = GetAllConstStringFields(typeof(TK));

        // Assert — every TK constant value must exist in en-US.json
        tkConstants.Should().NotBeEmpty("TK should have at least one constant defined");

        foreach (var (fieldName, value) in tkConstants)
        {
            enKeys.Should().Contain(
                value,
                $"TK constant '{fieldName}' has value '{value}' which is missing from en-US.json");
        }
    }

    /// <summary>
    /// Verifies that at least one constant is found in TK (sanity check for the reflection logic).
    /// </summary>
    [Fact]
    public void TKReflection_FindsExpectedConstants()
    {
        // Act
        var constants = GetAllConstStringFields(typeof(TK));

        // Assert — we know TK has at least Common.Errors.NOT_FOUND and Geo.Validation.IP_REQUIRED
        constants.Should().Contain(c => c.Value == "common_errors_NOT_FOUND");
        constants.Should().Contain(c => c.Value == "geo_validation_ip_required");
    }

    #endregion

    #region Helpers

    /// <summary>
    /// Recursively collects all <c>const string</c> field values from a type and its nested types.
    /// </summary>
    private static List<(string FieldName, string Value)> GetAllConstStringFields(Type type)
    {
        var results = new List<(string FieldName, string Value)>();

        // Get const string fields on this type
        var fields = type.GetFields(BindingFlags.Public | BindingFlags.Static | BindingFlags.FlattenHierarchy);
        foreach (var field in fields)
        {
            if (field is { IsLiteral: true, FieldType.Name: "String" })
            {
                var value = field.GetValue(null) as string;
                if (value is not null)
                {
                    results.Add(($"{type.Name}.{field.Name}", value));
                }
            }
        }

        // Recurse into nested types
        foreach (var nestedType in type.GetNestedTypes(BindingFlags.Public | BindingFlags.Static))
        {
            results.AddRange(GetAllConstStringFields(nestedType));
        }

        return results;
    }

    #endregion
}
