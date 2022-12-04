---
sidebar_position: 8
---
# Analysing the map

Once you have a map, you may want to examine it for themes and patterns. This is easiest if you examine portions of the map, or 'sub-maps', one at a time.  As  Barbrook-Johnson and Penn (2021) explain , network analysis can be combined with subjective information to answer a range of questions, as indicated in the table below.

<table class="analysis">
<thead>
<tr class="header">
<th><strong>Way to start</strong></th>
<th><strong>Starting point options</strong></th>
<th><strong>How to build</strong></th>
<th><strong>Interpretation</strong></th>
<th><strong>How to do it with PRSM</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td rowspan="9"><strong>Stakeholder-suggested factors</strong></td>
<td rowspan="3">Intervention or controllable factors</td>
<td>Downstream factors and edges</td>
<td>What is the intervention or controllable factor affecting? Unexpected indirect effects?</td>
<td>Select the intervention factor and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="even">
<td>For multiple factors create a union or intersection of multiple downstream submaps</td>
<td>How are multiple interventions complementing or clashing with each other?</td>
<td>Select all the interventions and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="odd">
<td>Paths between intervention factors and outcome factors, including ego networks of factors on paths</td>
<td>What does the intervention rely on to achieve its goals? What wider context might affect it?</td>
<td>Select all the factors on the path(s) between the intervention(s) and the outcomes(s), and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="even">
<td rowspan="4">Important or outcome factors</td>
<td>Upstream factors and edges</td>
<td>What is influencing the thing we care about? Constraints? Control? Buffered or buffeted?</td>
<td>Select the intervention factor and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="odd">
<td>For multiple factors create a union or intersection of ego networks. Or, pull out paths between outcomes.</td>
<td>What trade-offs or synergies might there be between achieving the things we care about?</td>
<td>Select all the interventions and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="even">
<td><p>Ego networks</p>
<p> </p></td>
<td>What is influencing the thing we care about, what does it influence and how do those things interact?</td>
<td>Select the factor and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="odd">
<td>Union or intersection of upstream factors and edges</td>
<td>What factors influence multiple outcomes? Identify potential levers in the system, co-benefits, synergies, or risks.</td>
<td>Select all the outcome factors and choose ‘Show only Factors upstream’</td>
</tr>
<tr class="even">
<td rowspan="2">Vulnerable to change factors</td>
<td>Up and/or downstream factors and edges</td>
<td>What might mitigate change in this factor? What impact might change have?</td>
<td>Select one or more factors and choose ‘Show only Factors 1 link away’ (or 2 or 3 links away)</td>
</tr>
<tr class="odd">
<td>Union/intersection multiple downstream sub maps</td>
<td>Are there compound risks, how might interventions interact with external change?</td>
<td>Select factors and choose ‘Show only Factors downstream’</td>
</tr>
<tr class="even">
<td rowspan="5"><strong>System-suggested factors</strong></td>
<td>Influential (i.e. many outgoing connections)</td>
<td>Downstream factors and edges</td>
<td>What is this influential thing affecting? Vulnerability or lever?</td>
<td>First, set ‘Size Factors to: Outputs’ to see which factors have many outgoing connections. Then select an influential factor and choose ‘Show only Factors downstream’.</td>
</tr>
<tr class="odd">
<td rowspan="2">Central to the map (i.e. well-connected, or bridging)</td>
<td>Downstream and/or upstream factors and edges</td>
<td>What is influencing this central factor? What influence does it have? Bottleneck, bridge, transmitter?</td>
<td>First, set ‘Size Factors to: Centrality’ to see which factors are central. Then select a central factor and choose ‘Show only Factors upstream’.</td>
</tr>
<tr class="even">
<td>Ego networks</td>
<td>What does this factor bridge or connect?</td>
<td>First, set ‘Size Factors to: Centrality’ to see which factors are central. Then select a central factor and choose ‘Show only Factors 1 link away’.</td>
</tr>
<tr class="odd">
<td>Influenced (i.e. many incoming connections)</td>
<td>Upstream factors and edges</td>
<td>What is influencing this highly influenced factor? Buffered or buffeted?</td>
<td>First, set ‘Size Factors to: Inputs’ to see which factors have many incoming connections. Then select a factor and choose ‘Show only Factors upstream'.</td>
</tr>
<tr class="even">
<td>Unusual network property</td>
<td>Any of the above</td>
<td>Does this factor play an important but counter-intuitive role in the system? </td>
<td>Set ‘Size Factors to: Leverage’ to see which factors have either many incoming but few outgoing connections or few outgoing but many incoming connections.</td>
</tr>
</tbody>
</table>
With thanks to Alex Penn and Pete Barbrook-Johnson for the original of this table, adapted from

[Barbrook-Johnson, P., & Penn, A. (2021). Participatory systems mapping for complex energy policy evaluation. *Evaluation*, 27(1), 57–79](https://doi.org/10.1177/1356389020976153).
