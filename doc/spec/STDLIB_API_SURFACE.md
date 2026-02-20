# Lumen Standard Library: API Surface + Stability Policy (v0.9-draft)

> **Note:** This document sketches a hosted standard library for Lumen’s earlier v0.9 direction (effects/async/IO). It is **not** normative for the v1.0 “new C” core language in `SPEC.md`.

> **Status:** Draft, *normative* unless marked non‑normative.  
> **Purpose:** Define the public standard library modules, naming conventions, and the “real” function/type signatures
> a compiler + tooling can target.

This document is structured as:
1. Stability policy (tiers, semver, editions, deprecations)
2. Module map (what exists)
3. Canonical public API signatures (types, traits, functions)

Effects appear in signatures as in Lumen spec: `async`, `throws`, `io`.

---

## 1. Stability Policy (Normative)

### 1.1 Tiers
The standard library is split into three tiers:

- **`core`**: always available, minimal dependencies, no IO, no allocation assumptions beyond language runtime primitives.
  - Breaking changes are forbidden within an **Edition**.
- **`std`**: full standard library; may include allocation, IO, networking, async runtime hooks.
  - Breaking changes are forbidden within an **Edition**.
  - Additive changes (new functions/types/trait impls) are allowed in MINOR releases.
- **`experimental`**: shipped with distribution but behind explicit feature gates.
  - May change at any time; no stability promises.
  - Items must be clearly marked `@unstable` with tracking issue id.

### 1.2 Versioning
- The language distribution has a version: `Lumen X.Y.Z`.
- `core` and `std` follow the distribution version.
- Package ecosystems follow SemVer independently, but `std` is not versioned separately.

### 1.3 Editions
- Breaking changes to `core`/`std` require a new **Edition**.
- Code declares edition in `lumen.toml`.
- Tooling provides migration: `lumen fix --edition <next>`.

### 1.4 Deprecations and removals
- Deprecations use `@deprecated("message")` and remain for at least one MINOR release cycle and never less than 6 months.
- Removal only in:
  - next MAJOR distribution release **or**
  - next Edition (whichever policy is adopted; official policy must be consistent across releases).

### 1.5 API guidelines
- All public items must have docs.
- All fallible operations return `Result[T, E]` (no hidden exceptions).
- IO-capable functions must include `io` in effects.
- Async functions must include `async`.
- Functions that can fail must include `throws` (or return Result without `throws` only if not using `try` propagation; standard style uses `throws` for ergonomics and `Result` for explicit types).

### 1.6 Naming conventions
- Types: `PascalCase`
- Functions/methods: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Modules: `snake_case`

---

## 2. Module Map (Normative)

### 2.1 `core`
- `core.prelude`
- `core.option`
- `core.result`
- `core.bool`
- `core.int`, `core.float`
- `core.tuple`
- `core.cmp`
- `core.hash`
- `core.fmt`
- `core.iter`
- `core.ops`
- `core.mem`
- `core.convert`

### 2.2 `std`
- `std.prelude`
- `std.string`
- `std.bytes`
- `std.vec`
- `std.map`
- `std.set`
- `std.atomic`
- `std.simd`
- `std.io`
- `std.path`
- `std.env`
- `std.time`
- `std.rand` *(may be `io` by policy)*
- `std.task`
- `std.sync`
- `std.net.http`
- `std.net.tcp`
- `std.net.udp`
- `std.json`
- `std.log`
- `std.test` *(test builds)*
- `std.process`

### 2.3 `experimental`
- `experimental.pin`
- `experimental.generators`
- `experimental.reflection`
- `experimental.macro`

---

## 3. Prelude (Normative)

### 3.1 `core.prelude` re-exports
Automatically in scope in all modules:
- `Option`, `Some`, `None`
- `Result`, `Ok`, `Err`
- `Bool`, `Int`, `UInt`, `F64`, `String` (String is in std prelude, not core, depending on build mode)
- Traits: `Eq`, `Ord`, `Hash`, `Iterator`, `IntoIterator`, `Display`, `Debug`, `Error`
- Functions: `panic`, `assert`, `assertEq`, `todo`, `unreachable`

### 3.2 `std.prelude` adds
- `Vec`, `Map`, `Set`, `Bytes`
- IO traits: `Read`, `Write`
- Concurrency: `Task`, `Channel`
- Time: `Duration`, `Instant`

---

## 4. Canonical Core Types and Traits (Normative)

### 4.1 `core.option`
```lumen
pub enum Option[T] {
  Some(T),
  None,
}

pub fn Option.some[T](v: T) -> Option[T]
pub fn Option.none[T]() -> Option[T]

pub fn Option.isSome[T](self: &Option[T]) -> Bool
pub fn Option.isNone[T](self: &Option[T]) -> Bool
pub fn Option.unwrap[T](self: Option[T]) -> T throws          // Err on None (typed as throws via std.error)
pub fn Option.unwrapOr[T](self: Option[T], default: T) -> T
pub fn Option.map[T, U](self: Option[T], f: fn(T) -> U) -> Option[U]
pub fn Option.andThen[T, U, ρ](self: Option[T], f: fn(T) ρ -> Option[U]) ρ -> Option[U]
```

### 4.2 `core.result`
```lumen
pub enum Result[T, E] {
  Ok(T),
  Err(E),
}

pub fn Result.ok[T, E](v: T) -> Result[T, E]
pub fn Result.err[T, E](e: E) -> Result[T, E]

pub fn Result.isOk[T, E](self: &Result[T, E]) -> Bool
pub fn Result.isErr[T, E](self: &Result[T, E]) -> Bool
pub fn Result.unwrap[T, E](self: Result[T, E]) -> T throws
pub fn Result.unwrapErr[T, E](self: Result[T, E]) -> E throws
pub fn Result.map[T, E, U](self: Result[T, E], f: fn(T) -> U) -> Result[U, E]
pub fn Result.mapErr[T, E, F](self: Result[T, E], f: fn(E) -> F) -> Result[T, F]
pub fn Result.andThen[T, E, U, ρ](self: Result[T, E], f: fn(T) ρ -> Result[U, E]) ρ -> Result[U, E]
```

### 4.3 `core.cmp`
```lumen
pub trait Eq {
  fn eq(&self, other: &Self) -> Bool;
}

pub enum Ordering { Less, Equal, Greater }

pub trait Ord: Eq {
  fn cmp(&self, other: &Self) -> Ordering;
}
```

### 4.4 `core.hash`
```lumen
pub trait Hash {
  fn hash(&self, state: &mut Hasher) -> ();
}

pub trait Hasher {
  fn write(&mut self, bytes: &[U8]) -> ();
  fn finish(&self) -> U64;
}
```

### 4.5 `core.fmt`
```lumen
pub trait Display {
  fn fmt(&self, f: &mut Formatter) -> ();
}

pub trait Debug {
  fn fmt(&self, f: &mut Formatter) -> ();
}

pub struct Formatter {
  // opaque
}

pub fn format(fmt: String, args: &[Any]) -> String  // non-normative placeholder; real formatting uses macros
```

### 4.6 `core.iter`
```lumen
pub trait Iterator[T] {
  fn next(&mut self) -> Option[T];
  fn map[U, ρ](&mut self, f: fn(T) ρ -> U) ρ -> MapIter[T, U, ρ];
  fn filter[ρ](&mut self, p: fn(&T) ρ -> Bool) ρ -> FilterIter[T, ρ];
  fn collect[C](&mut self) -> C where C: FromIterator[T];
}

pub trait IntoIterator[T] {
  fn intoIter(self) -> dyn Iterator[T];
}

pub trait FromIterator[T] {
  fn fromIter(it: &mut dyn Iterator[T]) -> Self;
}
```

### 4.7 `core.convert`
```lumen
pub trait Into[T] { fn into(self) -> T; }
pub trait From[T] { fn from(v: T) -> Self; }
```

---

## 5. Standard Library Containers (Normative)

### 5.1 `std.string`
```lumen
pub struct String { /* owned UTF-8 */ }
pub struct Str { /* borrowed view */ }   // typically behind &Str

pub fn String.new() -> String
pub fn String.fromUtf8(bytes: Bytes) throws -> String
pub fn String.asStr(self: &String) -> &Str
pub fn String.len(self: &String) -> Int
pub fn String.isEmpty(self: &String) -> Bool
pub fn String.push(self: &mut String, ch: Char) -> ()
pub fn String.pushStr(self: &mut String, s: &Str) -> ()
pub fn String.split(self: &Str, delim: Char) -> Vec[String]
pub fn String.toBytes(self: &String) -> Bytes
```

### 5.2 `std.bytes`
```lumen
pub struct Bytes { /* owned bytes */ }
pub fn Bytes.new() -> Bytes
pub fn Bytes.len(self: &Bytes) -> Int
pub fn Bytes.isEmpty(self: &Bytes) -> Bool
pub fn Bytes.slice(self: &Bytes, start: Int, end: Int) throws -> Bytes
```

### 5.3 `std.vec`
```lumen
pub struct Vec[T] { /* growable array */ }

pub fn Vec.new[T]() -> Vec[T]
pub fn Vec.withCapacity[T](cap: Int) -> Vec[T]
pub fn Vec.len[T](self: &Vec[T]) -> Int
pub fn Vec.isEmpty[T](self: &Vec[T]) -> Bool
pub fn Vec.capacity[T](self: &Vec[T]) -> Int
pub fn Vec.push[T](self: &mut Vec[T], value: T) -> ()
pub fn Vec.pop[T](self: &mut Vec[T]) -> Option[T]
pub fn Vec.get[T](self: &Vec[T], index: Int) -> Option[&T]
pub fn Vec.getMut[T](self: &mut Vec[T], index: Int) -> Option[&mut T]
pub fn Vec.insert[T](self: &mut Vec[T], index: Int, value: T) throws -> ()
pub fn Vec.remove[T](self: &mut Vec[T], index: Int) throws -> T
pub fn Vec.clear[T](self: &mut Vec[T]) -> ()
pub fn Vec.extend[T, I](self: &mut Vec[T], it: I) -> () where I: IntoIterator[T]
pub fn Vec.iter[T](self: &Vec[T]) -> dyn Iterator[&T]
pub fn Vec.iterMut[T](self: &mut Vec[T]) -> dyn Iterator[&mut T]
```

### 5.4 `std.map`
```lumen
pub struct Map[K, V] { /* hash map */ }

pub fn Map.new[K, V]() -> Map[K, V]
pub fn Map.len[K, V](self: &Map[K, V]) -> Int
pub fn Map.isEmpty[K, V](self: &Map[K, V]) -> Bool
pub fn Map.get[K, V](self: &Map[K, V], key: &K) -> Option[&V] where K: Eq + Hash
pub fn Map.getMut[K, V](self: &mut Map[K, V], key: &K) -> Option[&mut V] where K: Eq + Hash
pub fn Map.insert[K, V](self: &mut Map[K, V], key: K, value: V) -> Option[V] where K: Eq + Hash
pub fn Map.remove[K, V](self: &mut Map[K, V], key: &K) -> Option[V] where K: Eq + Hash
pub fn Map.containsKey[K, V](self: &Map[K, V], key: &K) -> Bool where K: Eq + Hash
pub fn Map.keys[K, V](self: &Map[K, V]) -> dyn Iterator[&K]
pub fn Map.values[K, V](self: &Map[K, V]) -> dyn Iterator[&V]
```

### 5.5 `std.set`
```lumen
pub struct Set[T] { /* hash set */ }

pub fn Set.new[T]() -> Set[T]
pub fn Set.len[T](self: &Set[T]) -> Int
pub fn Set.contains[T](self: &Set[T], v: &T) -> Bool where T: Eq + Hash
pub fn Set.insert[T](self: &mut Set[T], v: T) -> Bool where T: Eq + Hash
pub fn Set.remove[T](self: &mut Set[T], v: &T) -> Bool where T: Eq + Hash
pub fn Set.iter[T](self: &Set[T]) -> dyn Iterator[&T]
```

---

## 6. Errors and Results (Normative)

### 6.1 `std.error`
```lumen
pub trait Error: Debug + Display {
  fn message(&self) -> &Str;
  fn code(&self) -> Option[Int];
  fn cause(&self) -> Option[Ref[dyn Error]];
  fn backtrace(&self) -> Option[Backtrace];
}

pub struct Backtrace { /* opaque */ }

pub struct StdError { /* default error */ }
pub fn StdError.new(msg: String) -> StdError
```

### 6.2 Conventions
- APIs may define specific error enums (preferred) or use `StdError`.
- Any `throws` in std must correspond to a `Result` error path with an `Error` implementor.

---

## 7. IO, Files, Paths, Env (Normative)

### 7.1 `std.io` traits
```lumen
pub trait Read {
  fn read(self: &mut Self, buf: &mut [U8]) io throws -> Int;    // returns bytes read
}

pub trait Write {
  fn write(self: &mut Self, buf: &[U8]) io throws -> Int;
  fn flush(self: &mut Self) io throws -> ();
}

pub struct IoError { /* implements Error */ }
```

### 7.2 Files
```lumen
pub struct File { /* OS file handle */ }

pub enum OpenMode { Read, Write, Append, ReadWrite }

pub fn File.open(path: &Str, mode: OpenMode) io throws -> File
pub fn File.close(self: &mut File) io -> ()                      // close errors are non-recoverable? (policy may vary)
pub fn File.readToEnd(self: &mut File) io throws -> Bytes
pub fn File.writeAll(self: &mut File, buf: &[U8]) io throws -> ()
pub fn File.seek(self: &mut File, pos: SeekFrom) io throws -> Int

pub enum SeekFrom { Start(Int), End(Int), Current(Int) }
```

### 7.3 Paths
```lumen
pub struct Path { /* owned path */ }
pub struct PathBuf { /* owned growable path */ }

pub fn Path.join(self: &Path, other: &Path) -> PathBuf
pub fn Path.toStr(self: &Path) -> Option[&Str]
pub fn Path.exists(self: &Path) io -> Bool
pub fn Path.isFile(self: &Path) io -> Bool
pub fn Path.isDir(self: &Path) io -> Bool

pub fn PathBuf.new() -> PathBuf
pub fn PathBuf.push(self: &mut PathBuf, part: &Str) -> ()
pub fn PathBuf.asPath(self: &PathBuf) -> &Path
```

### 7.4 Environment
```lumen
pub fn env.get(key: &Str) io -> Option[String]
pub fn env.set(key: &Str, value: &Str) io throws -> ()
pub fn env.currentDir() io throws -> PathBuf
```

---

## 8. Time and Randomness (Normative)

### 8.1 `std.time`
```lumen
pub struct Duration { /* nanoseconds */ }
pub struct Instant { /* monotonic */ }
pub struct DateTime { /* wall clock */ }

pub fn Duration.fromMillis(ms: Int) -> Duration
pub fn Duration.fromSeconds(s: Int) -> Duration

pub fn Instant.now() io -> Instant
pub fn Instant.elapsed(self: &Instant) io -> Duration

pub fn time.nowUtc() io -> DateTime
```

### 8.2 `std.rand`
Randomness is classified as IO by policy.
```lumen
pub fn rand.u64() io -> U64
pub fn rand.bytes(n: Int) io -> Bytes
```

---

## 9. Async Tasks, Channels, Sync (Normative)

### 9.1 `std.task`
```lumen
pub struct Task[T] { /* join handle */ }
pub struct Cancellation { /* token */ }

pub fn task.spawn[T, ρ](f: fn() async ρ -> T) io -> Task[T]      // spawning affects scheduler => io
pub fn Task.join[T](self: Task[T]) async throws -> T
pub fn task.sleep(d: Duration) async io -> ()
pub fn task.cancel(tok: &Cancellation) io -> ()
pub fn task.currentCancellation() -> Cancellation
```

### 9.2 `std.sync`
```lumen
pub struct Mutex[T] { /* opaque */ }
pub struct RwLock[T] { /* opaque */ }

pub fn Mutex.new[T](v: T) -> Mutex[T]
pub fn Mutex.lock[T](self: &Mutex[T]) io throws -> MutexGuard[T]

pub struct MutexGuard[T] { /* RAII */ }
pub fn MutexGuard.get[T](self: &mut MutexGuard[T]) -> &mut T

pub fn RwLock.new[T](v: T) -> RwLock[T]
pub fn RwLock.read[T](self: &RwLock[T]) io throws -> RwReadGuard[T]
pub fn RwLock.write[T](self: &RwLock[T]) io throws -> RwWriteGuard[T]

pub struct RwReadGuard[T] { }
pub struct RwWriteGuard[T] { }
pub fn RwReadGuard.get[T](self: &RwReadGuard[T]) -> &T
pub fn RwWriteGuard.get[T](self: &mut RwWriteGuard[T]) -> &mut T
```

### 9.3 `std.channel`
```lumen
pub struct Sender[T] { }
pub struct Receiver[T] { }

pub fn channel.bounded[T](cap: Int) -> (Sender[T], Receiver[T])
pub fn Sender.send[T](self: &Sender[T], v: T) async io throws -> ()
pub fn Receiver.recv[T](self: &Receiver[T]) async io throws -> T
pub fn Receiver.tryRecv[T](self: &Receiver[T]) io -> Option[T]
```

---

## 10. Networking and HTTP (Normative)

### 10.1 `std.net.tcp`
```lumen
pub struct TcpListener { }
pub struct TcpStream { }

pub fn TcpListener.bind(addr: &Str) io throws -> TcpListener
pub fn TcpListener.accept(self: &TcpListener) async io throws -> TcpStream

pub fn TcpStream.connect(addr: &Str) async io throws -> TcpStream
pub fn TcpStream.read(self: &mut TcpStream, buf: &mut [U8]) async io throws -> Int
pub fn TcpStream.write(self: &mut TcpStream, buf: &[U8]) async io throws -> Int
```

### 10.2 `std.net.http`
```lumen
pub struct Request { }
pub struct Response { status: Int, body: Bytes, headers: Map[String, String] }

pub struct Client { }
pub fn Client.new() -> Client
pub fn Client.get(self: &Client, url: &Str) async io throws -> Response
pub fn Client.post(self: &Client, url: &Str, body: Bytes) async io throws -> Response

pub struct Server { }
pub struct Router { }

pub fn http.server() -> Server
pub fn Server.route(self: &mut Server) -> Router
pub fn Router.get(self: &mut Router, path: &Str, handler: fn(Request) async throws io -> Response) -> ()
pub fn Router.post(self: &mut Router, path: &Str, handler: fn(Request) async throws io -> Response) -> ()
pub fn Server.listen(self: Server, port: Int) async io throws -> ()
```

---

## 11. JSON (Normative)

### 11.1 `std.json`
```lumen
pub enum Json {
  Null,
  Bool(Bool),
  Number(F64),
  String(String),
  Array(Vec[Json]),
  Object(Map[String, Json]),
}

pub fn json.parse(s: &Str) throws -> Json
pub fn json.stringify(v: &Json) -> String
```

### 11.2 Serde traits (feature-gated)
```lumen
pub trait Serialize { fn toJson(&self) -> Json; }
pub trait Deserialize: Sized { fn fromJson(v: &Json) throws -> Self; }
```

---

## 12. Logging (Normative)

### 12.1 `std.log`
```lumen
pub enum Level { Trace, Debug, Info, Warn, Error }

pub fn log.setLevel(l: Level) io -> ()
pub fn log.info(msg: &Str) io -> ()
pub fn log.warn(msg: &Str) io -> ()
pub fn log.error(msg: &Str) io -> ()
pub fn log.event(level: Level, msg: &Str, fields: Map[String, Json]) io -> ()
```

---

## 13. Testing (Normative for test builds)

### 13.1 `std.test`
```lumen
pub fn test.assert(cond: Bool, msg: &Str) -> () throws
pub fn test.assertEq[T](a: T, b: T) -> () throws where T: Eq + Debug
pub fn test.snapshot(name: &Str, value: &Str) io throws -> ()    // snapshots touch filesystem => io
```

---

## 14. Process (Normative)

### 14.1 `std.process`
```lumen
pub struct Command { }
pub struct Output { status: Int, stdout: Bytes, stderr: Bytes }

pub fn Command.new(program: &Str) -> Command
pub fn Command.arg(self: &mut Command, a: &Str) -> ()
pub fn Command.env(self: &mut Command, k: &Str, v: &Str) -> ()
pub fn Command.run(self: Command) async io throws -> Output
```

---

## 15. Atomics and SIMD (Normative)

These modules provide a high-DX layer for performance-critical code while preserving explicit control over ordering and codegen.
They are intended for hosted toolchains, but the APIs are usable in freestanding environments if the platform supports the required primitives.

### 15.1 `std.atomic` (Normative)

`std.atomic` is a thin wrapper over `core.atomic` that:
- exposes all memory order knobs explicitly
- provides convenience helpers for common patterns (CAS loops, backoff)
- enables better diagnostics and linting (see `TOOLING.md`)

Re-exports (normative):
```lumen
pub use core.atomic::{MemoryOrder, AtomicBool, AtomicU32, AtomicI32, AtomicUsize, AtomicIsize};
pub use core.atomic::{fence, compilerFence};
```

Convenience helpers (normative):
```lumen
pub fn atomic.loadBool(p: Ptr[AtomicBool], order: MemoryOrder) -> Bool
pub fn atomic.storeBool(p: Ptr[AtomicBool], v: Bool, order: MemoryOrder) -> ()

pub fn atomic.loadUsize(p: Ptr[AtomicUsize], order: MemoryOrder) -> Usize
pub fn atomic.storeUsize(p: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> ()

pub fn atomic.casUsize(
  p: Ptr[AtomicUsize],
  expected: Ptr[Usize],
  desired: Usize,
  success: MemoryOrder,
  failure: MemoryOrder,
) -> Bool
```

Backoff (normative):
```lumen
pub struct Backoff { /* opaque */ }
pub fn Backoff.new() -> Backoff
pub fn Backoff.spin(self: Ptr[Backoff]) -> ()
pub fn Backoff.snooze(self: Ptr[Backoff]) -> ()
```

### 15.2 `std.simd` (Normative)

`std.simd` provides explicit SIMD vector types and operations with a portable interface.
Implementations may lower operations to target SIMD instructions (SSE/AVX/NEON/etc.) when available, and may provide software fallbacks.

Vector types (normative minimum set for hosted toolchains):
```lumen
pub struct U8x16 { /* opaque */ }
pub struct I32x4 { /* opaque */ }
pub struct U32x4 { /* opaque */ }
pub struct F32x4 { /* opaque */ }   // only when `target_has_float`
pub struct F64x2 { /* opaque */ }   // only when `target_has_float`
```

Constructors (“literal-like” APIs) (normative):
```lumen
pub fn U8x16.splat(x: U8) -> U8x16
pub fn U8x16.new(a0: U8, a1: U8, a2: U8, a3: U8, a4: U8, a5: U8, a6: U8, a7: U8,
                 a8: U8, a9: U8, a10: U8, a11: U8, a12: U8, a13: U8, a14: U8, a15: U8) -> U8x16

pub fn I32x4.splat(x: I32) -> I32x4
pub fn I32x4.new(a0: I32, a1: I32, a2: I32, a3: I32) -> I32x4
```

Loads/stores (normative):
```lumen
pub unsafe fn U8x16.load(p: Ptr[U8]) -> U8x16
pub unsafe fn U8x16.loadUnaligned(p: Ptr[U8]) -> U8x16
pub unsafe fn U8x16.store(self: U8x16, p: Ptr[U8]) -> ()
pub unsafe fn U8x16.storeUnaligned(self: U8x16, p: Ptr[U8]) -> ()
```

Arithmetic and bit ops (normative subset):
```lumen
pub fn I32x4.add(self: I32x4, other: I32x4) -> I32x4
pub fn I32x4.sub(self: I32x4, other: I32x4) -> I32x4
pub fn U8x16.and(self: U8x16, other: U8x16) -> U8x16
pub fn U8x16.or(self: U8x16, other: U8x16) -> U8x16
pub fn U8x16.xor(self: U8x16, other: U8x16) -> U8x16
```

Lane access (normative):
```lumen
pub fn I32x4.lane(self: I32x4, idx: Usize) -> I32
pub fn I32x4.withLane(self: I32x4, idx: Usize, v: I32) -> I32x4
```

Shuffles/select (normative):
```lumen
pub fn U8x16.shuffle(self: U8x16, idx: [U8; 16]) -> U8x16
pub fn U8x16.select(mask: U8x16, a: U8x16, b: U8x16) -> U8x16
```

## 16. Backwards Compatibility Guarantees (Normative Summary)

Within the same Edition:
- Existing `core`/`std` public items will not change signature or semantics incompatibly.
- New items may be added.
- New trait impls may be added **only if** they do not introduce coherence ambiguities for existing code;
  if ambiguity risk exists, the addition must be postponed to a new Edition or be feature-gated.

---

## 17. Non-normative: Future Work
- A formatting macro system (`fmt!`, `dbg!`) with compile-time checking
- Stronger iterator ergonomics (`for` desugaring details)
- `std.fs` split from `std.io`
- HTTP types richer (streaming bodies, headers types)
