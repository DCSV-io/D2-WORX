// -----------------------------------------------------------------------
// <copyright file="RedactDataDestructuringPolicy.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Shared.ServiceDefaults.Logging;

using System.Collections.Concurrent;
using System.Diagnostics.CodeAnalysis;
using System.Reflection;
using D2.Shared.Utilities.Attributes;
using Serilog.Core;
using Serilog.Events;

/// <summary>
/// Serilog destructuring policy that processes <see cref="RedactDataAttribute"/> on types
/// and properties, replacing annotated values with a redaction placeholder in log output.
/// </summary>
/// <remarks>
/// <para>Reflection results are cached per type via a <see cref="ConcurrentDictionary{TKey,TValue}"/>
/// so that repeated destructuring of the same type incurs no repeated reflection cost.</para>
/// <para>
/// Type-level <c>[RedactData]</c> → entire value replaced with
/// <c>[REDACTED: {Reason}]</c>.
/// </para>
/// <para>
/// Property-level <c>[RedactData]</c> → individual properties masked, others destructured
/// normally (recursive via <see cref="ILogEventPropertyValueFactory"/>).
/// </para>
/// </remarks>
public class RedactDataDestructuringPolicy : IDestructuringPolicy
{
    private static readonly ConcurrentDictionary<Type, TypeRedactionInfo> sr_cache = new();

    /// <inheritdoc />
    public bool TryDestructure(
        object value,
        ILogEventPropertyValueFactory factory,
        [NotNullWhen(true)] out LogEventPropertyValue? result)
    {
        var type = value.GetType();
        var info = sr_cache.GetOrAdd(type, AnalyzeType);

        // Type-level [RedactData] → replace entire value.
        if (info.TypeRedactionReason is not null)
        {
            result = new ScalarValue($"[REDACTED: {info.TypeRedactionReason}]");
            return true;
        }

        // No property-level redactions → let Serilog handle normally.
        if (info.PropertyRedactions.Count == 0)
        {
            result = null;
            return false;
        }

        // Build StructureValue with redacted properties.
        var properties = new List<LogEventProperty>();
        foreach (var prop in info.AllProperties)
        {
            if (info.PropertyRedactions.TryGetValue(prop.Name, out var reason))
            {
                properties.Add(new LogEventProperty(
                    prop.Name,
                    new ScalarValue($"[REDACTED: {reason}]")));
            }
            else
            {
                var propValue = prop.GetValue(value);
                properties.Add(new LogEventProperty(
                    prop.Name,
                    factory.CreatePropertyValue(propValue, destructureObjects: true)));
            }
        }

        result = new StructureValue(properties, type.Name);
        return true;
    }

    private static TypeRedactionInfo AnalyzeType(Type type)
    {
        // Check type-level attribute.
        var typeAttr = type.GetCustomAttribute<RedactDataAttribute>();
        if (typeAttr is not null)
        {
            var reason = typeAttr.CustomReason ?? typeAttr.Reason.ToString();
            return new TypeRedactionInfo(reason, [], []);
        }

        // Check property-level attributes.
        var allProps = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
        var redactions = new Dictionary<string, string>();
        foreach (var prop in allProps)
        {
            var propAttr = prop.GetCustomAttribute<RedactDataAttribute>();
            if (propAttr is not null)
            {
                var reason = propAttr.CustomReason ?? propAttr.Reason.ToString();
                redactions[prop.Name] = reason;
            }
        }

        return new TypeRedactionInfo(null, allProps, redactions);
    }

    /// <summary>
    /// Cached analysis result for a single type.
    /// </summary>
    private sealed record TypeRedactionInfo(
        string? TypeRedactionReason,
        PropertyInfo[] AllProperties,
        Dictionary<string, string> PropertyRedactions);
}
