// -----------------------------------------------------------------------
// <copyright file="IRepository.BeginTx.cs" company="DCSV">
// Copyright (c) DCSV. All rights reserved.
// </copyright>
// -----------------------------------------------------------------------

namespace D2.Contracts.Interfaces.Repository;

using D2.Contracts.Handler;
using D2.Contracts.Utilities.Enums;

public partial interface IRepository
{
    /// <summary>
    /// Handler for beginning a database transaction.
    /// </summary>
    public interface IBeginTxHandler : IHandler<BeginTxInput, BeginTxOutput>;

    /// <summary>
    /// Input for beginning a database transaction.
    /// </summary>
    /// <param name="Level">
    /// The isolation level for the transaction. Defaults to ReadCommitted.
    /// </param>
    public record BeginTxInput(IsolationLevel Level = IsolationLevel.ReadCommitted);

    /// <summary>
    /// Output for beginning a database transaction.
    /// </summary>
    public record BeginTxOutput;
}
