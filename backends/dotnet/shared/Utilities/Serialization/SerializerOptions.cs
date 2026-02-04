// -----------------------------------------------------------------------
// <copyright file="SerializerOptions.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Utilities.Serialization;

using System.Text.Json;
using System.Text.Json.Serialization;

/// <summary>
/// Provides predefined JSON serializer options.
/// </summary>
public static class SerializerOptions
{
    /// <summary>
    /// Gets JSON serializer options that ignore reference cycles during serialization.
    /// </summary>
    public static readonly JsonSerializerOptions SR_IgnoreCycles = new()
    {
        ReferenceHandler = ReferenceHandler.IgnoreCycles,
    };
}
