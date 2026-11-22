/** Real competitive programming snippets used across the tests. */
export const SEGMENT_TREE = `#include <bits/stdc++.h>
using namespace std;

// Segment Tree de sumas con actualización puntual
template <typename T>
struct SegTree {
    int n;
    vector<T> t;
    SegTree(int n) : n(n), t(2 * n, 0) {}

    void update(int p, T value) {
        for (t[p += n] = value; p > 1; p >>= 1) t[p >> 1] = t[p] + t[p ^ 1];
    }

    /* suma en [l, r) */
    T query(int l, int r) {
        T res = 0;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if (l & 1) res += t[l++];
            if (r & 1) res += t[--r];
        }
        return res;
    }
};
`;

export const DSU = `struct DSU {
    vector<int> p, sz;
    DSU(int n) : p(n), sz(n, 1) { iota(p.begin(), p.end(), 0); }
    int find(int x) { return p[x] == x ? x : p[x] = find(p[x]); }
    bool unite(int a, int b) {
        a = find(a), b = find(b);
        if (a == b) return false;
        if (sz[a] < sz[b]) swap(a, b);
        p[b] = a;
        sz[a] += sz[b];
        return true;
    }
};
`;

export const MACROS = `#include <bits/stdc++.h>
#define ll long long
#define REP(i, n) for (int i = 0; i < (n); ++i)
#define all(x) (x).begin(), (x).end()
const ll MOD = 1'000'000'007LL;
const double EPS = 1e-9;
int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n; cin >> n;
    vector<vector<ll>> dp(n + 1, vector<ll>(2, -1));
    auto s = "a // b"s;
    char c = '\\n';
    REP(i, n) dp[i][0] = i > 0 ? dp[i - 1][1] : 0;
    cout << (a & b) << ' ' << (a && b) << ' ' << -(-x) << ' ' << a - -b << "\\n";
}
`;

export const BITMASK_DP = `int tsp(int mask, int pos) {
\tif (mask == (1 << n) - 1) return dist[pos][0];
\tint &res = memo[mask][pos];
\tif (res != -1) return res;
\tres = INT_MAX;
\tfor (int nxt = 0; nxt < n; nxt++)
\t\tif (!(mask >> nxt & 1)) res = min(res, dist[pos][nxt] + tsp(mask | 1 << nxt, nxt));
\treturn res;
}
`;

export const RAW_AND_TEMPLATES = `auto pattern = R"re(\\d+ "x" \\s*)re";
map<string, vector<pair<int, int>>> g;
auto cmp = [&](const auto &a, const auto &b) { return a.first < b.first; };
static_assert(sizeof(int) >= 4, "int muy pequeño");
`;

export const CORPUS = { SEGMENT_TREE, DSU, MACROS, BITMASK_DP, RAW_AND_TEMPLATES };
