/** Built-in C++ references used until the user imports their own collection. */
export interface Sample {
  id: string;
  name: string;
  code: string;
}

export const SAMPLES: Sample[] = [
  {
    id: 'dsu',
    name: 'DSU (Union-Find)',
    code: `struct DSU {
    vector<int> p, sz;
    DSU(int n) : p(n), sz(n, 1) { iota(p.begin(), p.end(), 0); }

    int find(int x) {
        while (x != p[x]) x = p[x] = p[p[x]];
        return x;
    }

    bool unite(int a, int b) {
        a = find(a), b = find(b);
        if (a == b) return false;
        if (sz[a] < sz[b]) swap(a, b);
        p[b] = a;
        sz[a] += sz[b];
        return true;
    }
};`,
  },
  {
    id: 'segtree',
    name: 'Segment Tree',
    code: `template <typename T>
struct SegTree {
    int n;
    vector<T> t;
    SegTree(int n) : n(n), t(2 * n, 0) {}

    void update(int p, T value) {
        for (t[p += n] = value; p > 1; p >>= 1) t[p >> 1] = t[p] + t[p ^ 1];
    }

    T query(int l, int r) {
        T res = 0;
        for (l += n, r += n; l < r; l >>= 1, r >>= 1) {
            if (l & 1) res += t[l++];
            if (r & 1) res += t[--r];
        }
        return res;
    }
};`,
  },
  {
    id: 'fenwick',
    name: 'Fenwick Tree (BIT)',
    code: `struct Fenwick {
    int n;
    vector<long long> bit;
    Fenwick(int n) : n(n), bit(n + 1, 0) {}

    void add(int i, long long delta) {
        for (++i; i <= n; i += i & -i) bit[i] += delta;
    }

    long long sum(int i) {
        long long s = 0;
        for (++i; i > 0; i -= i & -i) s += bit[i];
        return s;
    }
};`,
  },
  {
    id: 'bfs',
    name: 'BFS en grafo',
    code: `vector<int> bfs(const vector<vector<int>>& adj, int src) {
    vector<int> dist(adj.size(), -1);
    queue<int> q;
    dist[src] = 0;
    q.push(src);
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        for (int v : adj[u]) {
            if (dist[v] == -1) {
                dist[v] = dist[u] + 1;
                q.push(v);
            }
        }
    }
    return dist;
}`,
  },
  {
    id: 'dijkstra',
    name: 'Dijkstra',
    code: `const long long INF = 1e18;

vector<long long> dijkstra(const vector<vector<pair<int, int>>>& adj, int s) {
    vector<long long> d(adj.size(), INF);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<>> pq;
    d[s] = 0;
    pq.push({0, s});
    while (!pq.empty()) {
        auto [du, u] = pq.top();
        pq.pop();
        if (du != d[u]) continue;
        for (auto [v, w] : adj[u]) {
            if (d[u] + w < d[v]) {
                d[v] = d[u] + w;
                pq.push({d[v], v});
            }
        }
    }
    return d;
}`,
  },
  {
    id: 'sieve',
    name: 'Criba de Eratóstenes',
    code: `vector<int> sieve(int n) {
    vector<bool> composite(n + 1, false);
    vector<int> primes;
    for (int i = 2; i <= n; i++) {
        if (composite[i]) continue;
        primes.push_back(i);
        for (long long j = 1LL * i * i; j <= n; j += i) composite[j] = true;
    }
    return primes;
}`,
  },
  {
    id: 'binpow',
    name: 'Exponenciación binaria',
    code: `const int MOD = 1'000'000'007;

long long binpow(long long a, long long e, long long m = MOD) {
    long long r = 1;
    a %= m;
    while (e > 0) {
        if (e & 1) r = r * a % m;
        a = a * a % m;
        e >>= 1;
    }
    return r;
}`,
  },
  {
    id: 'kmp',
    name: 'KMP (función prefijo)',
    code: `vector<int> prefixFunction(const string& s) {
    int n = s.size();
    vector<int> pi(n, 0);
    for (int i = 1; i < n; i++) {
        int k = pi[i - 1];
        while (k > 0 && s[i] != s[k]) k = pi[k - 1];
        if (s[i] == s[k]) k++;
        pi[i] = k;
    }
    return pi;
}`,
  },
  {
    id: 'template',
    name: 'Plantilla de concurso',
    code: `#include <bits/stdc++.h>
using namespace std;

#define all(x) (x).begin(), (x).end()
using ll = long long;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t;
    cin >> t;
    while (t--) {
        int n;
        cin >> n;
        vector<ll> a(n);
        for (auto& x : a) cin >> x;
        sort(all(a));
        cout << a.back() - a.front() << '\\n';
    }
    return 0;
}`,
  },
];
