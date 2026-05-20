import requests
#documentation de l'api : https://jdm-api.demo.lirmm.fr/schema

base_url = "https://jdm-api.demo.lirmm.fr"

# Faire une requête GET
def get_request(endpoint):
    response = requests.get(f"{base_url}{endpoint}")
    if response.status_code == 200:
        return response.json()
    else:
        print(f"Erreur : {response.status_code}")
        return None

# Récupérer un noeud à partir de son id
def nodeGetById(node_id):
    endpoint = f"/v0/node_by_id/{node_id}"
    return get_request(endpoint)

# Récupérer un noeud à partir de son nom
def nodeGetByName(node_name):
    endpoint = f"/v0/node_by_name/{node_name}"
    return get_request(endpoint)

# Récupérer les raffinements d'un noeud terme à partir de son nom
def nodeGetRefinements(node_name):
    endpoint = f"/v0/refinements/{node_name}"
    return get_request(endpoint)

# Récupérer les relations sortantes d'un noeud à partir de son nom    
def relationGetRelationsFrom(node_name):   
    endpoint = f"/v0/relations/from/{node_name}"
    return get_request(endpoint)

# Récupérer les relations entrantes à un noeud à partir de son nom    
def relationGetRelationsTo(node_name):
    endpoint = f"/v0/relations/to/{node_name}"
    return get_request(endpoint)

# Récupérer les relations entre deux noeuds à partir de leur noms
def relationGetRelationsFromTo(node1_name,node2_name):
    endpoint = f"/v0/relations/from/{node1_name}/to/{node2_name}"
    return get_request(endpoint)

# Récupérer tous les types de noeuds
def publicNodeTypeGetAll(): 
    endpoint = f"/v0/nodes_types"
    return get_request(endpoint)

# Récupérer tous les types de relations
def relationTypeGetAll():
    endpoint = f"/v0/relations_types"
    return get_request(endpoint)

relationTypes = relationTypeGetAll()

# Récupérer nom de la relation à partir du type
def getRelationName(type):
    if relationTypes:
        return relationTypes[type]['name']
    else:
        return None

# Récupérer nom de la relation à partir du type
def getRelationType(relationName):
    if relationTypes:
        return next((relationType['id'] for relationType in relationTypes if relationType['name'] == relationName), None)
    else:
        return None

# Filtrer par le nom du type de relation
def filterByRelationTypeName(result, relationName):
    if relationTypes:
        return [relation for relation in result['relations'] if relation['type'] == getRelationType(relationName)]
    else:
        return None

# Filtrer par l'id du type de relation
def filterByRelationTypeId(result, id):
    if relationTypes:
        return [relation for relation in result['relations'] if relation['type'] == id]
    else:
        return None



# Tests
# Afficher les relations entre deux termes
myNode1 = "chat"
myNode2 = "internet"
result = relationGetRelationsFromTo(myNode1,myNode2)

if result :
    print(f"Relations entre les termes '{myNode1}' et '{myNode2}':")
    for relation in result['relations']:
        print((f"Relation : "
        f"{getRelationName(relation['type'])}" 
        f" / weight : {relation['w']}"))

# Afficher les relations d'un type spécifié : exemple des synonymes       
result = relationGetRelationsFrom(myNode1)
if result :
    print(f"Synonymes du terme '{myNode1}':")
    synonyms = filterByRelationTypeName(result, "r_syn")
    #synonyms = filterByRelationTypeId(result, 5)
    if synonyms :     
        for synonym in synonyms :
            node = nodeGetById(synonym['node2'])
            if node :
                print((f"- {node['name']}"
                f" / weight : {synonym['w']}"))